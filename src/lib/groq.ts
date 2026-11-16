import Groq, { RateLimitError } from "groq-sdk";
import {
  GROQ_COOLDOWN_MAX_SECONDS,
  GROQ_COOLDOWN_MIN_RETRY_AFTER_SECONDS,
  GROQ_MODEL,
  TOPICS,
  TRANSLATE_MAX_TOKENS,
} from "@/lib/config";
import { errorMessage } from "@/lib/errors";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { getGroqCooldown, nextUtcMidnight, recordGroq429, recordGroqCall, setGroqCooldown } from "@/lib/usage";
import type { AiAnalysis, FeedItem } from "@/lib/types";

export type GroqResult<T> = { data: T | null; error?: string };

const DEFAULT_RETRY_DELAY_MS = 5000;

// 429s seen by this server process, so a caller (the cron tick) can report
// how many happened during its own run by diffing before/after.
let rateLimitedCount = 0;
export function getGroqRateLimitedCount(): number {
  return rateLimitedCount;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let client: Groq | null | undefined;

function getClient(): Groq | null {
  if (client !== undefined) return client;
  client = process.env.GROQ_API_KEY ? new Groq() : null;
  return client;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const TOPIC_LIST = TOPICS.map((t) => `  - ${t.id}: ${t.description}`).join("\n");

function buildPrompt(item: FeedItem): string {
  // Kept short — Groq's free tier caps at 8,000 tokens/minute shared across
  // every concurrent request, so trimming input here (on top of a lower
  // max_tokens below) matters more than it would with a paid tier.
  const text = stripHtml(item.fullContentHtml ?? item.summary ?? "").slice(0, 2000);
  return `Title: ${item.title}\n\nContent: ${text || "(no content available, use the title alone)"}\n\n` +
    `Return a JSON object with:\n` +
    `- "summary": a neutral 2-3 sentence summary of the piece, in English\n` +
    `- "topics": an array of zero or more of these topic ids that genuinely apply:\n${TOPIC_LIST}\n` +
    `  The reader is a software developer following AI-assisted development. Only include a topic ` +
    `if the piece is actually about it. General tech, science, security, space, gaming, hardware ` +
    `or programming news with no real AI angle matches none — return []. Most items match none.\n` +
    `- "titleVi": a natural Vietnamese translation of the title\n` +
    `- "summaryVi": a natural Vietnamese translation of the summary you wrote above`;
}

// `deadline` (epoch ms) bounds a call made while a page is rendering: the
// request times out at it, and a 429 is only retried when Groq's
// retry-after still fits before it.
type CompletionOptions = { prompt: string; jsonMode?: boolean; maxTokens: number; deadline?: number };

// Below this much time left, a call is not worth starting.
const MIN_CALL_MS = 4000;

// Shared retry/backoff core for every Groq call in this app: on a 429 on
// the first attempt, sleep using Groq's own retry-after header (or a
// default) and try once more; any other failure (or a second 429) is left
// for the caller to catch, same fail-closed pattern as everywhere else.
async function requestCompletion(
  groq: Groq,
  { prompt, jsonMode, maxTokens, deadline }: CompletionOptions,
  logId: string,
  attempt: number
): Promise<string | null> {
  const remaining = deadline === undefined ? undefined : deadline - Date.now();
  if (remaining !== undefined && remaining < MIN_CALL_MS) {
    throw new Error(`no time left for ${logId} before the render deadline`);
  }
  try {
    const { data: completion, response } = await groq.chat.completions
      .create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      temperature: 0.3,
      // gpt-oss is a reasoning model — it spends tokens on internal
      // chain-of-thought before writing the actual answer. Low effort
      // keeps that short, and max_tokens has headroom for the answer itself.
      reasoning_effort: "low",
      max_tokens: maxTokens,
      }, remaining === undefined ? undefined : { timeout: remaining, maxRetries: 0 })
      .withResponse();
    await recordGroqCall(completion.usage, response.headers);
    return completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    if (err instanceof RateLimitError) {
      rateLimitedCount++;
      await recordGroq429();
    }
    if (err instanceof RateLimitError) {
      const retryAfter = Number(err.headers?.get?.("retry-after"));
      // A per-minute 429 asks for a few seconds; the daily one for minutes or
      // hours (or names the daily limit in its message). Retrying is pointless
      // then — pause Groq so later calls don't each earn another 429.
      const longWait = Number.isFinite(retryAfter) && retryAfter >= GROQ_COOLDOWN_MIN_RETRY_AFTER_SECONDS;
      const namesDaily = /\b(per day|TPD|RPD)\b/i.test(err.message ?? "");
      if (longWait || namesDaily) {
        const until = longWait
          ? Date.now() + Math.min(retryAfter, GROQ_COOLDOWN_MAX_SECONDS) * 1000
          : nextUtcMidnight();
        console.error(`[groq] daily limit hit on ${logId}, pausing until ${new Date(until).toISOString()}`);
        await setGroqCooldown(until, "retry-after");
        throw err;
      }
    }
    if (err instanceof RateLimitError && attempt === 0) {
      const retryAfter = Number(err.headers?.get?.("retry-after"));
      const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : DEFAULT_RETRY_DELAY_MS;
      const fits = deadline === undefined || Date.now() + delayMs + MIN_CALL_MS < deadline;
      if (fits) {
        console.error(`[groq] rate limited on ${logId}, retrying in ${delayMs}ms`);
        await sleep(delayMs);
        return requestCompletion(groq, { prompt, jsonMode, maxTokens, deadline }, logId, attempt + 1);
      }
      console.error(`[groq] rate limited on ${logId}; retry-after ${delayMs}ms does not fit the deadline`);
    }
    throw err;
  }
}

export async function classifyAndSummarize(item: FeedItem): Promise<GroqResult<AiAnalysis>> {
  const groq = getClient();
  if (!groq) return { data: null }; // not configured — not a failure
  if (await getGroqCooldown()) return { data: null }; // paused after hitting the daily cap

  try {
    const validIds = new Set(TOPICS.map((t) => t.id));
    const raw = await requestCompletion(
      groq,
      { prompt: buildPrompt(item), jsonMode: true, maxTokens: 900 },
      item.id,
      0
    );
    if (!raw) return { data: null };

    const parsed = JSON.parse(raw) as {
      summary?: unknown;
      topics?: unknown;
      titleVi?: unknown;
      summaryVi?: unknown;
    };
    if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return { data: null };

    const topics = Array.isArray(parsed.topics)
      ? parsed.topics.filter((t): t is string => typeof t === "string" && validIds.has(t))
      : [];

    // titleVi/summaryVi are validated independently and simply omitted if
    // missing/invalid — a translation hiccup shouldn't throw away an
    // otherwise-good English summary.
    const result: AiAnalysis = { summary: parsed.summary.trim(), topics };
    if (typeof parsed.titleVi === "string" && parsed.titleVi.trim()) {
      result.titleVi = parsed.titleVi.trim();
    }
    if (typeof parsed.summaryVi === "string" && parsed.summaryVi.trim()) {
      result.summaryVi = parsed.summaryVi.trim();
    }
    return { data: result };
  } catch (err) {
    console.error(`[groq] failed to classify/summarize ${item.id}:`, err);
    return { data: null, error: errorMessage(err) };
  }
}

// Plain-text-in/HTML-out translation of a full article body. Not JSON
// mode — escaping a whole article inside a JSON string is both wasteful
// and failure-prone if the response gets truncated mid-string.
export async function translateArticleHtml(
  logId: string,
  html: string,
  deadline?: number
): Promise<GroqResult<string>> {
  const groq = getClient();
  if (!groq) return { data: null }; // not configured — not a failure
  if (await getGroqCooldown()) return { data: null }; // paused after hitting the daily cap

  try {
    const prompt =
      "Translate the following HTML article body into natural Vietnamese. " +
      "Preserve the HTML tags and structure exactly, only translate the text " +
      "content. Return only the translated HTML, no commentary, no markdown " +
      `code fences.\n\n${html}`;
    const raw = await requestCompletion(groq, { prompt, maxTokens: TRANSLATE_MAX_TOKENS, deadline }, logId, 0);
    if (!raw) return { data: null };

    // The model occasionally wraps output in a markdown code fence despite
    // being asked not to — strip it defensively rather than failing.
    const cleaned = raw.trim().replace(/^```(?:html)?\n?/, "").replace(/```$/, "").trim();
    if (!cleaned) return { data: null };

    return { data: sanitizeArticleHtml(cleaned) };
  } catch (err) {
    console.error(`[groq] failed to translate article ${logId}:`, err);
    return { data: null, error: errorMessage(err) };
  }
}
