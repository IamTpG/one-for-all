import { slugify } from "../../slug.ts";

// Pure helpers shared by the markdown changelog parsers. No Next imports.

export const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// "Nov", "Sept", "November" -> 0-11, or -1.
export function monthIndex(name: string): number {
  const lower = name.trim().toLowerCase().replace(/\.$/, "");
  if (lower.length < 3) return -1;
  return MONTHS.findIndex((m) => m.startsWith(lower.slice(0, 3)));
}

// Day-precision dates are stored at 00:00 UTC.
export function dayIso(year: number, monthIdx: number, day: number): string | undefined {
  const d = new Date(Date.UTC(year, monthIdx, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIdx || d.getUTCDate() !== day) return undefined;
  return d.toISOString();
}

// Markdown to a single line of plain text: links keep their label, emphasis,
// code ticks, backslash escapes and Markdoc tags ({% ... %}) go.
export function plainText(md: string): string {
  return md
    .replace(/\{%[\s\S]*?%\}/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*{1,3}([^*\n]+?)\*{1,3}/g, "$1")
    .replace(/`+/g, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// The text up to the first sentence end, cut to `max` characters.
export function firstSentence(text: string, max: number): string {
  const plain = plainText(text);
  const end = plain.search(/[.!?](\s|$)/);
  const sentence = end > 0 ? plain.slice(0, end + 1) : plain;
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max / 2 ? cut.slice(0, space) : cut).trim() + "…";
}

// Root-relative links ("/docs/x") only make sense on the page's own site:
// make them absolute so they work from the feed.
export function absolutizeLinks(md: string, origin: string): string {
  return md.replace(/\]\((\/[^)\s]*)\)/g, (_m, path: string) => `](${origin}${path})`);
}

export function stripMarkdocTags(md: string): string {
  return md.replace(/\{%[\s\S]*?%\}/g, "");
}

// Key = prefix + slug, with -2, -3 on a repeat so every key in one parse is
// unique and still stable across parses.
export function uniqueKey(seen: Set<string>, base: string): string {
  let key = base;
  for (let n = 2; seen.has(key); n++) key = `${base}-${n}`;
  seen.add(key);
  return key;
}

export function keySlug(title: string, max = 60): string {
  return slugify(title).slice(0, max).replace(/-$/, "") || "entry";
}
