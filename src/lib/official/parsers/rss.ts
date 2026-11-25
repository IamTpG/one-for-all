import Parser from "rss-parser";

// Pure RSS/Atom parser for official sources (string -> entries). Depends only
// on rss-parser, so it runs under `node --test` outside Next. Network, size
// and time limits live in official/fetch.ts.

export interface RssEntry {
  /** Stable key: the guid, else the link. */
  key: string;
  title: string;
  url: string;
  /** ISO string, or undefined when the entry has no usable date. */
  publishedAt?: string;
  /** Body markup or markdown, as the feed ships it (content:encoded, else description). */
  body?: string;
  categories: string[];
}

type CustomItem = { contentEncoded?: string };

const parser: Parser<Record<string, never>, CustomItem> = new Parser({
  customFields: { item: [["content:encoded", "contentEncoded"]] },
});

export async function parseOfficialRss(xml: string): Promise<RssEntry[]> {
  const feed = await parser.parseString(xml);
  const entries: RssEntry[] = [];
  for (const item of feed.items ?? []) {
    const url = (item.link ?? "").trim();
    const key = (item.guid ?? url).trim();
    const title = (item.title ?? "").trim();
    if (!key || !url || !title) continue;
    const time = item.isoDate ? Date.parse(item.isoDate) : NaN;
    entries.push({
      key,
      title,
      url,
      publishedAt: Number.isFinite(time) ? new Date(time).toISOString() : undefined,
      body: item.contentEncoded || item.content || undefined,
      categories: (item.categories ?? []).map((c) => String(c).trim()).filter(Boolean),
    });
  }
  return entries;
}
