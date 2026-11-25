import type { UpdateKind } from "../../types.ts";
import type { ParsedEntry } from "./types.ts";
import {
  absolutizeLinks,
  dayIso,
  firstSentence,
  keySlug,
  monthIndex,
  uniqueKey,
} from "./markdownText.ts";

// Pure parser for the OpenAI API changelog (markdown):
//   ## November, 2026          sets the year
//   ### Nov 24                 one entry
//   Feature · Model: gpt-6 · API: v1/responses     the vendor's labels
//   body paragraphs
// The label line is the vendor's own classification and gives the kind.

const MONTH_HEADING = /^##\s+([A-Za-z]+),?\s+(\d{4})\s*$/;
const DAY_HEADING = /^###\s+([A-Za-z]+)\.?\s+(\d{1,2})\s*$/;
const LABEL_LINE = /^(Feature|Update|Fix|Announcement|Deprecation|Pricing|Rate limits?)\b(?:\s*·\s*.+)?\s*$/i;
const TITLE_MAX = 120;
const LAUNCH_WORDS = /\b(released?|launch\w*|introduc\w*|now available|generally available|available today)\b/i;

// Feature -> feature (model-release when a Model: label is present and the
// text says it launched); Deprecation -> deprecation; Pricing / Rate limits
// -> pricing; anything else (Update, Fix, Announcement) -> api-change.
export function kindFromLabels(labels: string[], bodyText: string): UpdateKind {
  const type = (labels[0] ?? "").toLowerCase();
  if (type === "deprecation") return "deprecation";
  if (type === "pricing" || type.startsWith("rate limit")) return "pricing";
  if (type === "feature") {
    const hasModel = labels.some((l) => /^model:/i.test(l));
    return hasModel && LAUNCH_WORDS.test(bodyText) ? "model-release" : "feature";
  }
  return "api-change";
}

export function parseMdOpenaiChangelog(md: string, opts: { pageUrl: string; origin: string }): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();
  let year: number | null = null;
  let block: { iso: string; lines: string[] } | null = null;

  const flush = () => {
    const current = block;
    block = null;
    if (!current) return;
    const lines = current.lines;
    while (lines.length && !lines[0].trim()) lines.shift();
    let labels: string[] = [];
    if (lines.length && LABEL_LINE.test(lines[0].trim())) {
      labels = lines.shift()!.split("·").map((l) => l.trim()).filter(Boolean);
    }
    const body = absolutizeLinks(lines.join("\n"), opts.origin).trim();
    if (!body) return;
    const title = firstSentence(body, TITLE_MAX);
    if (!title) return;
    entries.push({
      key: uniqueKey(seen, `${current.iso.slice(0, 10)}-${keySlug(title, 48)}`),
      title,
      url: opts.pageUrl,
      publishedAt: current.iso,
      body,
      bodyFormat: "markdown",
      categories: [],
      labels,
      kind: kindFromLabels(labels, body),
    });
  };

  for (const line of md.split(/\r?\n/)) {
    const monthHeading = line.match(MONTH_HEADING);
    if (monthHeading) {
      flush();
      year = Number(monthHeading[2]);
      continue;
    }
    const dayHeading = line.match(DAY_HEADING);
    if (dayHeading) {
      flush();
      const month = monthIndex(dayHeading[1]);
      const iso = year === null || month < 0 ? undefined : dayIso(year, month, Number(dayHeading[2]));
      block = iso ? { iso, lines: [] } : null;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush();
      continue;
    }
    block?.lines.push(line);
  }
  flush();
  return entries;
}
