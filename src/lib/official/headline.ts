// Pure: the title an official row shows. Groq's headline when there is one,
// else a derived one for a generic source title, else the title itself.
import type { FeedItem } from "../types.ts";
import { firstAddedItem } from "./analysis.ts";

export const FALLBACK_HEADLINE_MAX = 90;

const VERSION = /^v?\d+(?:\.\d+){0,3}(?:[-+.\w]*)$/i;
const RELEASE_VERSION = /\b(?:release|version)\b:?\s*v?\d+(?:\.\d+)+/i;

// "2.1.331", "anthropics/claude-code: v2.1.331", "Codex app", "Codex CLI
// Release: 0.131.0", "Claude Platform release notes - Nov 23, 2026".
export function isGenericTitle(title: string, product?: string): boolean {
  const stripped = title.replace(/^[\w.-]+\/[\w.-]+:\s*/, "").trim();
  if (VERSION.test(stripped) && /\d/.test(stripped)) return true;
  if (/release notes/i.test(title) || RELEASE_VERSION.test(title)) return true;
  if (product) {
    const t = stripped.toLowerCase();
    const p = product.toLowerCase();
    if (t === p || (t.startsWith(p) && t.split(/\s+/).length <= 3)) return true;
  }
  return false;
}

function clip(text: string): string {
  if (text.length <= FALLBACK_HEADLINE_MAX) return text;
  const cut = text.slice(0, FALLBACK_HEADLINE_MAX - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

// Product plus the first "Added / New features" list item, at most 90
// characters; undefined when the body has no list item to use.
export function fallbackHeadline(item: Pick<FeedItem, "fullContentHtml" | "official">): string | undefined {
  if (!item.fullContentHtml) return undefined;
  const first = firstAddedItem(item.fullContentHtml);
  if (!first) return undefined;
  const product = item.official?.product;
  return clip(product ? `${product}: ${first}` : first);
}

export function officialTitle(
  item: Pick<FeedItem, "title" | "fullContentHtml" | "official">
): string {
  const official = item.official;
  if (!official) return item.title;
  if (official.headline) return official.headline;
  if (official.kind && isGenericTitle(item.title, official.product)) {
    return fallbackHeadline(item) ?? item.title;
  }
  return item.title;
}
