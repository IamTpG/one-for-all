import type { UpdateKind } from "../types.ts";

// Pure: decides an official item's kind without Groq. Imports only types so
// it runs under `node --test` outside Next.

export const UPDATE_KINDS: readonly UpdateKind[] = [
  "model-release",
  "feature",
  "tool-release",
  "api-change",
  "deprecation",
  "pricing",
];

export function isUpdateKind(value: unknown): value is UpdateKind {
  return typeof value === "string" && (UPDATE_KINDS as readonly string[]).includes(value);
}

const DEPRECATION = /\b(deprecat\w*|retir(?:e|ed|es|ing|ement)|end of life|sunset\w*|no longer (?:served|available|supported))\b/i;
const PRICING = /\b(pricing|prices?|per 1m|rate limits?|credits|billing|free tier|quota)\b/i;
const LAUNCH = /\b(introducing|launch\w*|released?|now available|generally available|ga)\b/i;
const MODEL_ID =
  /\b(gpt[- ]?\d|o[1-9](?:-mini|-pro)?|claude (?:opus|sonnet|haiku)|gemini[- ]\d|gemma|grok[- ]?\d|genie)/i;
const MODEL_ID_KEY =
  /\b(gpt[- ]?\d[\w.]*|o[1-9](?:-mini|-pro)?|claude[- ](?:opus|sonnet|haiku)[- ]?\d[\w.]*|gemini[- ]\d[\w.]*|gemma[- ]?\d[\w.]*|grok[- ]?\d[\w.]*)(?![\w.])/i;

// Launch key without Groq: the first model id in the text, as a slug
// ("Gemini 4 Neon is generally available" -> "gemini-4").
export function modelIdKey(text: string): string | undefined {
  const match = MODEL_ID_KEY.exec(text);
  return match ? match[1].toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/\./g, "-") : undefined;
}

const API_CHANGE = /\b(api|sdk|endpoint|parameter|webhook|header|console|batch)\b/i;

// Ordered keyword rules over title + the start of the body. Returns undefined
// when nothing matches (a news-class entry then waits for Groq).
export function keywordKind(text: string): UpdateKind | undefined {
  if (DEPRECATION.test(text)) return "deprecation";
  if (PRICING.test(text)) return "pricing";
  if (LAUNCH.test(text) && MODEL_ID.test(text)) return "model-release";
  if (API_CHANGE.test(text)) return "api-change";
  return undefined;
}

export type KindRule = { titlePattern: string; kind: UpdateKind };

export type KindInput = {
  title: string;
  body?: string;
  sourceClass: "changelog" | "news";
  defaultKind?: UpdateKind;
  // Title patterns that fix the kind for part of a mixed source (the Codex
  // changelog mixes CLI releases with app and ChatGPT notes).
  rules?: KindRule[];
};

export type ResolvedKind = { kind?: UpdateKind; kindFrom: "source" | "keyword" };

// Source defaultKind wins, then per-source title rules, then keywords; a
// changelog-class entry with no match is a "feature"; a news-class one stays
// undefined.
export function resolveKind(input: KindInput): ResolvedKind {
  if (input.defaultKind) return { kind: input.defaultKind, kindFrom: "source" };
  for (const rule of input.rules ?? []) {
    if (new RegExp(rule.titlePattern, "i").test(input.title)) {
      return { kind: rule.kind, kindFrom: "source" };
    }
  }
  const text = `${input.title} ${(input.body ?? "").slice(0, 500)}`;
  const fromKeywords = keywordKind(text);
  if (fromKeywords) return { kind: fromKeywords, kindFrom: "keyword" };
  if (input.sourceClass === "changelog") return { kind: "feature", kindFrom: "source" };
  return { kind: undefined, kindFrom: "keyword" };
}
