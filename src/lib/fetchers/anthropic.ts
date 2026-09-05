import { errorMessage } from "@/lib/errors";
import { fetchWithTimeout } from "@/lib/http";
import type { FeedItem, FetchSourceResult } from "@/lib/types";

const BASE_URL = "https://www.anthropic.com";
const NEWS_URL = `${BASE_URL}/news`;

// Anthropic doesn't publish an RSS/Atom/JSON feed for /news, so this parses
// the listing page's server-rendered HTML directly. Their CSS-module class
// names look like "FeaturedGrid-module-scss-module__<hash>__title" — only
// the <hash> segment changes between their deployments, so matching on the
// "__title"/"__date"/"__body" suffix (rather than the full class name)
// survives most of their rebuilds. It can still break outright if they
// restructure the page; this fails closed (returns []) like every other
// fetcher in this app when that happens, rather than throwing.
const ITEM_RE = /<a href="(\/news\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g;
const TITLE_RE = /__title[^"]*">([^<]+)</;
const DATE_RE = /__date[^"]*"[^>]*>([^<]+)</;
const BODY_RE = /__body[^"]*">([^<]+)</;

export async function fetchAnthropicNews(limit: number): Promise<FetchSourceResult[]> {
  const sourceId = "anthropic";
  const label = "Anthropic";
  try {
    const res = await fetchWithTimeout(NEWS_URL);
    if (!res.ok) throw new Error(`Anthropic news page returned ${res.status}`);
    const html = await res.text();

    const items: FeedItem[] = [];
    const seen = new Set<string>();

    for (const match of html.matchAll(ITEM_RE)) {
      const [, href, block] = match;
      if (seen.has(href)) continue;

      const title = block.match(TITLE_RE)?.[1]?.trim();
      if (!title) continue;
      seen.add(href);

      const dateText = block.match(DATE_RE)?.[1];
      const parsedDate = dateText ? new Date(dateText) : null;

      items.push({
        id: `anthropic:${href}`,
        source: "Anthropic",
        sourceId: "anthropic",
        sourceType: "rss",
        title,
        url: `${BASE_URL}${href}`,
        summary: block.match(BODY_RE)?.[1]?.trim(),
        publishedAt:
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString()
            : new Date().toISOString(),
      });
    }

    return [{ sourceId, label, items: items.slice(0, limit), ok: true }];
  } catch (err) {
    console.error("[anthropic] failed to fetch news:", err);
    return [{ sourceId, label, items: [], ok: false, error: errorMessage(err) }];
  }
}
