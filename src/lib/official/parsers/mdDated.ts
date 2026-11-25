import type { ParsedEntry } from "./types.ts";
import {
  absolutizeLinks,
  dayIso,
  firstSentence,
  keySlug,
  monthIndex,
  plainText,
  stripMarkdocTags,
  uniqueKey,
} from "./markdownText.ts";

// Pure parser for the Gemini API changelog (markdown):
//   ## November 19, 2026  {% id="11-19-2026" %}
//   *   **Title**: text, possibly over several indented lines
// Each top-level bullet is one entry. A bullet without a "**Title**:" gets
// its first sentence as the title.

const DATE_HEADING = /^##\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*(?:\{%\s*id="([^"]+)"\s*%\})?\s*$/;
const BULLET = /^[*-]\s+(.*)$/;
const BOLD_TITLE = /^\*\*([\s\S]+?)\*\*\s*:|^\*\*([\s\S]+?):\*\*/;
const TITLE_MAX = 120;

type Day = { iso: string; ymd: string; anchor: string };

export function parseMdDated(md: string, opts: { pageUrl: string; origin: string }): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();
  let day: Day | null = null;
  let bullet: string[] | null = null;

  const flush = () => {
    const lines = bullet;
    bullet = null;
    if (!day || !lines) return;
    const text = lines.join("\n").trim();
    if (!text) return;
    const bold = text.match(BOLD_TITLE);
    const titleRaw = bold ? (bold[1] ?? bold[2]) : "";
    const title = (titleRaw ? plainText(titleRaw).replace(/:$/, "") : firstSentence(text, TITLE_MAX)).trim();
    if (!title) return;
    const rest = bold ? text.slice(bold[0].length).trim() : text;
    const body = absolutizeLinks(stripMarkdocTags(rest), opts.origin).trim();
    entries.push({
      key: uniqueKey(seen, `${day.ymd}-${keySlug(title)}`),
      title: title.length > TITLE_MAX ? title.slice(0, TITLE_MAX - 1).trimEnd() + "…" : title,
      url: `${opts.pageUrl}#${day.anchor}`,
      publishedAt: day.iso,
      body: body || undefined,
      bodyFormat: "markdown",
      categories: [],
    });
  };

  for (const line of md.split(/\r?\n/)) {
    const heading = line.match(DATE_HEADING);
    if (heading) {
      flush();
      const month = monthIndex(heading[1]);
      const iso = month < 0 ? undefined : dayIso(Number(heading[3]), month, Number(heading[2]));
      day = iso ? { iso, ymd: iso.slice(0, 10), anchor: heading[4] ?? iso.slice(0, 10) } : null;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush();
      day = null;
      continue;
    }
    if (!day) continue;
    const start = line.match(BULLET);
    if (start) {
      flush();
      bullet = [start[1]];
    } else if (bullet) {
      bullet.push(line.replace(/^ {1,4}/, ""));
    }
  }
  flush();
  return entries;
}
