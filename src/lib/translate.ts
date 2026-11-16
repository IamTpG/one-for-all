import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
import {
  AI_CACHE_TTL_SECONDS,
  TRANSLATE_CHUNKS_PER_RUN,
  TRANSLATE_MAX_CHARS,
  TRANSLATE_RENDER_BUDGET_MS,
} from "@/lib/config";
import { recordGroqFailure } from "@/lib/dashboardStats";
import { translateArticleHtml } from "@/lib/groq";
import { enforceGroqBudget } from "@/lib/usage";
import { getJson, setJson } from "@/lib/redis";

const KEY_PREFIX = "wire:translation:";

export type TranslationPart = { html: string; translated: boolean };

export type ArticleTranslation = {
  // In reading order. Translated parts come first; once one part is
  // missing, everything after it stays in English so the article never
  // switches language more than once.
  parts: TranslationPart[];
  // Parts still in English after this run.
  remaining: number;
  // True when a Groq call failed (or Groq is off) rather than the run
  // simply stopping at its batch limit.
  failed: boolean;
};

// ---------- Splitting ----------

type DomNode = {
  nodeType: number;
  nodeName: string;
  outerHTML?: string;
  textContent: string | null;
  childNodes: ArrayLike<DomNode>;
  attributes?: ArrayLike<{ name: string; value: string }>;
};

function nodeHtml(node: DomNode): string {
  if (node.nodeType === 1) return node.outerHTML ?? "";
  if (node.nodeType === 3) return node.textContent ?? "";
  return "";
}

function openTag(node: DomNode): string {
  const tag = node.nodeName.toLowerCase();
  const attrs = Array.from(node.attributes ?? [])
    .map((attr) => ` ${attr.name}="${attr.value.replace(/"/g, "&quot;")}"`)
    .join("");
  return `<${tag}${attrs}>`;
}

// Packs sibling nodes into chunks of at most `max` chars, splitting only
// between nodes. A node too large on its own is split inside (each piece
// re-wrapped in a copy of its tag, so a long list stays a list); a leaf
// that still doesn't fit becomes a chunk of its own.
function packNodes(nodes: DomNode[], max: number): string[] {
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current);
    current = "";
  };

  for (const node of nodes) {
    const html = nodeHtml(node);
    if (!html) continue;
    if (current.length + html.length <= max) {
      current += html;
      continue;
    }
    flush();
    if (html.length <= max) {
      current = html;
      continue;
    }
    const children = Array.from(node.childNodes ?? []);
    const hasElementChildren = children.some((child) => child.nodeType === 1);
    if (node.nodeType !== 1 || !hasElementChildren) {
      chunks.push(html);
      continue;
    }
    const tag = node.nodeName.toLowerCase();
    const open = openTag(node);
    const close = `</${tag}>`;
    for (const inner of packNodes(children, max - open.length - close.length)) {
      chunks.push(open + inner + close);
    }
  }
  flush();
  return chunks;
}

export function splitHtml(html: string, max: number = TRANSLATE_MAX_CHARS): string[] {
  if (html.length <= max) return [html];
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const body = document.body as unknown as DomNode;
  const chunks = packNodes(Array.from(body.childNodes), max);
  return chunks.length > 0 ? chunks : [html];
}

// ---------- Translation ----------

function chunkKey(itemId: string, chunk: string): string {
  const hash = createHash("sha1").update(chunk).digest("hex").slice(0, 12);
  return `${KEY_PREFIX}${itemId}:${hash}`;
}

// A chunk is not started with less time than this left: one chunk takes
// several seconds even when Groq is not rate limited.
const MIN_CHUNK_MS = 12_000;

async function translateOne(
  itemId: string,
  html: string,
  deadline: number
): Promise<{ text: string | null; failed: boolean }> {
  // Out of daily budget: skip the call instead of earning a 429.
  if (process.env.GROQ_API_KEY && (await enforceGroqBudget())) return { text: null, failed: true };
  const { data, error } = await translateArticleHtml(itemId, html, deadline);
  if (error) await recordGroqFailure({ ts: Date.now(), stage: "translate", itemId, message: error });
  return { text: data, failed: !data };
}

// Lazy, on-demand, cached (like the AI summary cache): an article is only
// translated when someone opens it in Vietnamese, never during aggregation.
//
// Short articles (≤ TRANSLATE_MAX_CHARS) are one call. Longer ones are
// split at block boundaries and translated chunk by chunk. Every cache
// entry is keyed by the hash of the HTML it translates. (Entries under the
// old per-item key `wire:translation:<id>` are no longer read; they expire
// on their own TTL.) One run translates at
// most TRANSLATE_CHUNKS_PER_RUN missing chunks: Groq's free tier allows
// 8,000 tokens a minute and one chunk uses about half of that, so a long
// article finishes over several runs (the reader asks for the next one).
//
// Everything runs inside a page render, so it is bounded by a deadline
// (TRANSLATE_RENDER_BUDGET_MS from now): no chunk starts too close to it,
// and Groq calls time out at it instead of running past the function limit.
export async function getArticleTranslation(
  itemId: string,
  html: string,
  deadline: number = Date.now() + TRANSLATE_RENDER_BUDGET_MS
): Promise<ArticleTranslation> {
  if (html.length <= TRANSLATE_MAX_CHARS) {
    // Keyed by content like the chunks, so a source that changes (an
    // edited post, a README) is translated again instead of served stale.
    const key = chunkKey(itemId, html);
    const cached = await getJson<string>(key);
    if (cached) return { parts: [{ html: cached, translated: true }], remaining: 0, failed: false };
    const { text, failed } = await translateOne(itemId, html, deadline);
    if (!text) return { parts: [{ html, translated: false }], remaining: 1, failed };
    await setJson(key, text, AI_CACHE_TTL_SECONDS);
    return { parts: [{ html: text, translated: true }], remaining: 0, failed: false };
  }

  const chunks = splitHtml(html);
  const keys = chunks.map((chunk) => chunkKey(itemId, chunk));
  const cached = await Promise.all(keys.map((key) => getJson<string>(key)));

  const parts: TranslationPart[] = [];
  let budget = TRANSLATE_CHUNKS_PER_RUN;
  let failed = false;
  let stopped = false;

  // Sequential on purpose: parallel calls would only trip the per-minute
  // token limit sooner.
  for (let i = 0; i < chunks.length; i++) {
    if (!stopped && cached[i]) {
      parts.push({ html: cached[i]!, translated: true });
      continue;
    }
    const timeLeft = deadline - Date.now() >= MIN_CHUNK_MS;
    if (!stopped && budget > 0 && timeLeft) {
      budget--;
      const result = await translateOne(itemId, chunks[i], deadline);
      if (result.text) {
        await setJson(keys[i], result.text, AI_CACHE_TTL_SECONDS);
        parts.push({ html: result.text, translated: true });
        continue;
      }
      failed = result.failed;
    }
    stopped = true;
    parts.push({ html: chunks[i], translated: false });
  }

  return { parts, remaining: parts.filter((part) => !part.translated).length, failed };
}
