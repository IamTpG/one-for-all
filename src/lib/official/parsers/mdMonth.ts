import type { ParsedEntry } from "./types.ts";
import { absolutizeLinks, keySlug, monthIndex, plainText, uniqueKey } from "./markdownText.ts";

// Pure parser for the xAI API release notes (markdown):
//   ## November          month only: no year, no day
//   ### Title            one entry
//   body
// The date is approximate: publishedAt is the 1st of the month and
// dateApprox is "month". The year is the current one, or the previous one
// when the month is later than the current month (notes are newest first and
// never look ahead); every further month heading steps back through the years. Key = slug(title), so it does not change with the date.

const MONTH_HEADING = /^##\s+([A-Za-z]+)(?:\s*,?\s*(\d{4}))?\s*$/;
const ENTRY_HEADING = /^###\s+(.+?)\s*$/;
const TITLE_MAX = 120;

export function parseMdMonth(md: string, opts: { pageUrl: string; origin: string; now: Date }): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();
  const nowYear = opts.now.getUTCFullYear();
  const nowMonth = opts.now.getUTCMonth();
  let month: { iso: string } | null = null;
  let last: { year: number; idx: number } | null = null;
  let current: { title: string; iso: string; lines: string[] } | null = null;

  const flush = () => {
    const entry = current;
    current = null;
    if (!entry) return;
    const body = absolutizeLinks(entry.lines.join("\n"), opts.origin).trim();
    entries.push({
      key: uniqueKey(seen, keySlug(entry.title, 80)),
      title: entry.title.length > TITLE_MAX ? entry.title.slice(0, TITLE_MAX - 1).trimEnd() + "…" : entry.title,
      url: opts.pageUrl,
      publishedAt: entry.iso,
      dateApprox: "month",
      body: body || undefined,
      bodyFormat: "markdown",
      categories: [],
    });
  };

  for (const line of md.split(/\r?\n/)) {
    const monthHeading = line.match(MONTH_HEADING);
    if (monthHeading) {
      flush();
      const idx = monthIndex(monthHeading[1]);
      if (idx < 0) {
        month = null;
        continue;
      }
      // Newest first: a month that is not earlier than the one above it
      // belongs to the previous year.
      const year: number = monthHeading[2]
        ? Number(monthHeading[2])
        : last
          ? (idx < last.idx ? last.year : last.year - 1)
          : idx > nowMonth ? nowYear - 1 : nowYear;
      last = { year, idx };
      month = { iso: new Date(Date.UTC(year, idx, 1)).toISOString() };
      continue;
    }
    const entryHeading = line.match(ENTRY_HEADING);
    if (entryHeading && month) {
      flush();
      const title = plainText(entryHeading[1]);
      current = title ? { title, iso: month.iso, lines: [] } : null;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush();
      continue;
    }
    current?.lines.push(line);
  }
  flush();
  return entries;
}
