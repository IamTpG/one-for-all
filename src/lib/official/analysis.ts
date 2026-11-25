// Pure: the official-update prompt, the validation of Groq's answer, and the
// merge of that answer into an item's `official` info. Relative imports with
// extensions so it runs under `node --test` outside Next.
import { TOPICS } from "../config.ts";
import { PUBLISHERS } from "../sourceRegistry.ts";
import type { AiAnalysis, FeedItem, OfficialInfo } from "../types.ts";
import { isUpdateKind } from "./kind.ts";

export type SourceClass = "changelog" | "news";

export const OFFICIAL_PROMPT_CONTENT_CHARS = 2000;
export const HEADLINE_MAX = 120;
export const AVAILABILITY_MAX = 120;
export const LAUNCH_KEY_MAX = 60;

const SECTION_SPLIT = /(?=<h[1-6]\b)/i;
const HEADING = /^<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i;
const LEAD_SECTION = /^(added|new features?|new|features?|highlights?|what'?s new)\b/i;
const DROP_SECTION = /^(bug ?fix(?:es)?|fixed|fixes)\b/i;

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

type Section = { heading: string; html: string };

function splitSections(html: string): Section[] {
  return html
    .split(SECTION_SPLIT)
    .filter((part) => part.trim())
    .map((part) => {
      const match = HEADING.exec(part);
      return { heading: match ? stripTags(match[1]) : "", html: part };
    });
}

// A release body keeps what was added first and drops the bug-fix lists,
// which only spend the 2,000-character budget.
export function prioritiseBody(html: string): string {
  const sections = splitSections(html);
  const intro = sections.filter((s, i) => i === 0 && !s.heading);
  const rest = sections.filter((s) => s.heading);
  const lead = rest.filter((s) => LEAD_SECTION.test(s.heading));
  const other = rest.filter((s) => !LEAD_SECTION.test(s.heading) && !DROP_SECTION.test(s.heading));
  return [...intro, ...lead, ...other].map((s) => s.html).join(" ");
}

// The first list item under an "Added / New features" heading, else the
// first list item outside a bug-fix section.
export function firstAddedItem(html: string): string | null {
  const sections = splitSections(html);
  const pick = (candidates: Section[]): string | null => {
    for (const section of candidates) {
      const li = /<li\b[^>]*>([\s\S]*?)<\/li>/i.exec(section.html);
      const text = li ? stripTags(li[1]) : "";
      if (text) return text;
    }
    return null;
  };
  return (
    pick(sections.filter((s) => LEAD_SECTION.test(s.heading))) ??
    pick(sections.filter((s) => !DROP_SECTION.test(s.heading)))
  );
}

const TOPIC_LIST = TOPICS.map((t) => `  - ${t.id}: ${t.description}`).join("\n");

export type OfficialPromptContext = { sourceClass: SourceClass };

export function buildOfficialPrompt(item: FeedItem, ctx: OfficialPromptContext): string {
  const official = item.official;
  const vendor = (official && PUBLISHERS[official.publisher]?.name) ?? official?.publisher ?? "Vendor";
  const body = item.fullContentHtml ? stripTags(prioritiseBody(item.fullContentHtml)) : stripTags(item.summary ?? "");
  const text = body.slice(0, OFFICIAL_PROMPT_CONTENT_CHARS);
  const product = official?.product ? ` (product: ${official.product})` : "";
  return (
    `Official ${vendor} ${ctx.sourceClass} entry from "${item.source}"${product}.\n` +
    `Title: ${item.title} | Published: ${item.publishedAt.slice(0, 10)}\n\n` +
    `Content: ${text || "(no content available, use the title alone)"}\n\n` +
    `Return a JSON object with:\n` +
    `- "kind": model-release | feature | tool-release | api-change | deprecation | pricing | none\n` +
    `  (none = not a product change: customer story, policy, research essay, event, hiring)\n` +
    `- "headline": at most 90 characters, English, the single most important user-facing change (not a version number)\n` +
    `- "summary": 1-2 English sentences: what changed and how to use it (command, setting, model id)\n` +
    `- "availability": who gets it, terse: plans/tiers, platforms, regions, API/Console; "" if not stated\n` +
    `- "effectiveDate": YYYY-MM-DD if a future rollout/retirement/price date is named, else ""\n` +
    `- "launchKey": lowercase slug of the main model/product/feature ("gemini-4-neon"), "" if none\n` +
    `- "titleVi": Vietnamese of the headline; "summaryVi": Vietnamese of the summary.\n` +
    `  Keep product names, model ids, plan names and commands (/ship, Code Mode) in English.\n` +
    `- "topics": an array of zero or more of these topic ids that genuinely apply:\n${TOPIC_LIST}\n` +
    `  The reader is a software developer following AI-assisted development. Only include a topic ` +
    `if the piece is actually about it. Return [] when none applies.`
  );
}

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max).trim() : undefined;
}

function validDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const date = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== v ? undefined : v;
}

function validLaunchKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  // A slug cut in half would group unrelated launches, so too long is dropped.
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= LAUNCH_KEY_MAX ? v : undefined;
}

// Validates the parsed JSON of an official answer. Null when there is no
// usable summary (same bar as the community prompt). Every other field is
// validated alone and simply left out when invalid.
export function parseOfficialAnalysis(parsed: unknown, validTopicIds: ReadonlySet<string>): AiAnalysis | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const summary = cleanString(p.summary, 2000);
  if (!summary) return null;

  const topics = Array.isArray(p.topics)
    ? p.topics.filter((t): t is string => typeof t === "string" && validTopicIds.has(t))
    : [];
  const result: AiAnalysis = { summary, topics };

  const rawKind = typeof p.kind === "string" ? p.kind.trim().toLowerCase() : "";
  if (rawKind === "none" || isUpdateKind(rawKind)) result.kind = rawKind;
  const titleVi = cleanString(p.titleVi, 400);
  if (titleVi) result.titleVi = titleVi;
  const summaryVi = cleanString(p.summaryVi, 2000);
  if (summaryVi) result.summaryVi = summaryVi;
  const headline = cleanString(p.headline, HEADLINE_MAX);
  if (headline) result.headline = headline;
  const availability = cleanString(p.availability, AVAILABILITY_MAX);
  if (availability) result.availability = availability;
  const effectiveDate = validDate(p.effectiveDate);
  if (effectiveDate) result.effectiveDate = effectiveDate;
  const launchKey = validLaunchKey(p.launchKey);
  if (launchKey) result.launchKey = launchKey;
  return result;
}

export type MergeContext = {
  sourceClass: SourceClass;
  // The kind is fixed by the source (a defaultKind, or a versioned tool
  // release that groups per product): Groq's kind does not replace it.
  fixedKind: boolean;
};

// Merges Groq's answer into an item's official info. Groq's valid kind
// replaces a keyword or fallback kind. "none" only means something on a
// news-class item: it is not a product change, so it stops being an
// official update and its topics decide where it goes. An invalid or absent
// kind keeps what the item had.
export function mergeOfficialAnalysis(
  official: OfficialInfo | undefined,
  analysis: AiAnalysis | undefined,
  ctx: MergeContext
): OfficialInfo | undefined {
  if (!official || !analysis) return official;
  const next: OfficialInfo = { ...official };
  const kind = analysis.kind;

  if (kind === "none") {
    if (ctx.sourceClass === "news" && !ctx.fixedKind) {
      delete next.kind;
      delete next.headline;
      delete next.availability;
      delete next.effectiveDate;
      delete next.launchKey;
      next.kindFrom = "groq";
      return next;
    }
  } else if (kind && !ctx.fixedKind) {
    next.kind = kind;
    next.kindFrom = "groq";
  }
  if (analysis.headline) next.headline = analysis.headline;
  if (analysis.availability) next.availability = analysis.availability;
  if (analysis.effectiveDate) next.effectiveDate = analysis.effectiveDate;
  if (analysis.launchKey) next.launchKey = analysis.launchKey;
  return next;
}
