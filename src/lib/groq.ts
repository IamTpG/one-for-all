import Groq, { RateLimitError } from "groq-sdk";
import { GROQ_MODEL, TOPICS, TRANSLATE_MAX_TOKENS } from "@/lib/config";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import type { AiAnalysis, FeedItem } from "@/lib/types";

const DEFAULT_RETRY_DELAY_MS = 5000;

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

const TOPIC_LIST = TOPICS.map((t) => `${t.id} (${t.label})`).join(", ");

function buildPrompt(item: FeedItem): string {
  // Kept short — Groq's free tier caps at 8,000 tokens/minute shared across
  // every concurrent request, so trimming input here (on top of a lower
  // max_tokens below) matters more than it would with a paid tier.
  const text = stripHtml(item.fullContentHtml ?? item.summary ?? "").slice(0, 2000);
  return `Title: ${item.title}\n\nContent: ${text || "(no content available, use the title alone)"}\n\n` +
    `Return a JSON object with:\n` +
    `- "summary": a neutral 2-3 sentence summary of the piece, in English\n` +
    `- "topics": an array of zero or more of these topic ids that genuinely apply: ${TOPIC_LIST}. ` +
    `Only include a topic if the piece is actually about it — most items match none.\n` +
    `- "titleVi": a natural Vietnamese translation of the title\n` +
    `- "summaryVi": a natural Vietnamese translation of the summary you wrote above`;
}

type CompletionOptions = { prompt: string; jsonMode?: boolean; maxTokens: number };

// Shared retry/backoff core for every Groq call in this app: on a 429 on
// the first attempt, sleep using Groq's own retry-after header (or a
// default) and try once more; any other failure (or a second 429) is left
// for the caller to catch, same fail-closed pattern as everywhere else.
async function requestCompletion(
  groq: Groq,
  { prompt, jsonMode, maxTokens }: CompletionOptions,
  logId: string,
  attempt: number
): Promise<string | null> {
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      temperature: 0.3,
      // gpt-oss is a reasoning model — it spends tokens on internal
      // chain-of-thought before writing the actual answer. Low effort
      // keeps that short, and max_tokens has headroom for the answer itself.
      reasoning_effort: "low",
      max_tokens: maxTokens,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    if (err instanceof RateLimitError && attempt === 0) {
      const retryAfter = Number(err.headers?.get?.("retry-after"));
      const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : DEFAULT_RETRY_DELAY_MS;
      console.error(`[groq] rate limited on ${logId}, retrying in ${delayMs}ms`);
      await sleep(delayMs);
      return requestCompletion(groq, { prompt, jsonMode, maxTokens }, logId, attempt + 1);
    }
    throw err;
  }
}

export async function classifyAndSummarize(item: FeedItem): Promise<AiAnalysis | null> {
  const groq = getClient();
  if (!groq) return null;

  try {
    const validIds = new Set(TOPICS.map((t) => t.id));
    const raw = await requestCompletion(
      groq,
      { prompt: buildPrompt(item), jsonMode: true, maxTokens: 900 },
      item.id,
      0
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      summary?: unknown;
      topics?: unknown;
      titleVi?: unknown;
      summaryVi?: unknown;
    };
    if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return null;

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
    return result;
  } catch (err) {
    console.error(`[groq] failed to classify/summarize ${item.id}:`, err);
    return null;
  }
}

// Plain-text-in/HTML-out translation of a full article body. Not JSON
// mode — escaping a whole article inside a JSON string is both wasteful
// and failure-prone if the response gets truncated mid-string.
export async function translateArticleHtml(logId: string, html: string): Promise<string | null> {
  const groq = getClient();
  if (!groq) return null;

  try {
    const prompt =
      "Translate the following HTML article body into natural Vietnamese. " +
      "Preserve the HTML tags and structure exactly, only translate the text " +
      "content. Return only the translated HTML, no commentary, no markdown " +
      `code fences.\n\n${html}`;
    const raw = await requestCompletion(groq, { prompt, maxTokens: TRANSLATE_MAX_TOKENS }, logId, 0);
    if (!raw) return null;

    // The model occasionally wraps output in a markdown code fence despite
    // being asked not to — strip it defensively rather than failing.
    const cleaned = raw.trim().replace(/^```(?:html)?\n?/, "").replace(/```$/, "").trim();
    if (!cleaned) return null;

    return sanitizeArticleHtml(cleaned);
  } catch (err) {
    console.error(`[groq] failed to translate article ${logId}:`, err);
    return null;
  }
}
