import Groq, { RateLimitError } from "groq-sdk";
import { GROQ_MODEL, TOPICS } from "@/lib/config";
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
    `- "summary": a neutral 2-3 sentence summary of the piece\n` +
    `- "topics": an array of zero or more of these topic ids that genuinely apply: ${TOPIC_LIST}. ` +
    `Only include a topic if the piece is actually about it — most items match none.`;
}

async function requestCompletion(groq: Groq, item: FeedItem, attempt: number): Promise<string | null> {
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: buildPrompt(item) }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      // gpt-oss is a reasoning model — it spends tokens on internal
      // chain-of-thought before writing the actual answer. Low effort
      // keeps that short, and max_tokens has headroom for both.
      reasoning_effort: "low",
      max_tokens: 500,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    // Free-tier tokens-per-minute limit is shared across every concurrent
    // request in enrichWithTopicsAndSummaries, so hitting it occasionally
    // is expected, not a bug. Back off using Groq's own retry-after header
    // and try once more; a second failure just means this item waits for
    // the next aggregation cycle instead (fails closed, like everywhere
    // else in this app).
    if (err instanceof RateLimitError && attempt === 0) {
      const retryAfter = Number(err.headers?.get?.("retry-after"));
      const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : DEFAULT_RETRY_DELAY_MS;
      console.error(`[groq] rate limited on ${item.id}, retrying in ${delayMs}ms`);
      await sleep(delayMs);
      return requestCompletion(groq, item, attempt + 1);
    }
    throw err;
  }
}

export async function classifyAndSummarize(item: FeedItem): Promise<AiAnalysis | null> {
  const groq = getClient();
  if (!groq) return null;

  try {
    const validIds = new Set(TOPICS.map((t) => t.id));
    const raw = await requestCompletion(groq, item, 0);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { summary?: unknown; topics?: unknown };
    if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return null;

    const topics = Array.isArray(parsed.topics)
      ? parsed.topics.filter((t): t is string => typeof t === "string" && validIds.has(t))
      : [];

    return { summary: parsed.summary.trim(), topics };
  } catch (err) {
    console.error(`[groq] failed to classify/summarize ${item.id}:`, err);
    return null;
  }
}
