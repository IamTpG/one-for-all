import { errorMessage } from "@/lib/errors";
import { fetchWithTimeout } from "@/lib/http";
import { parseAnthropicNews } from "@/lib/official/parsers/anthropicNews";
import type { FeedItem, FetchSourceResult } from "@/lib/types";

const NEWS_URL = "https://www.anthropic.com/news";

// Anthropic doesn't publish an RSS/Atom/JSON feed for /news, so this parses
// the listing page's HTML (see parsers/anthropicNews.ts, which matches on
// structure rather than hashed class names). A 200 response that yields zero
// entries means the layout changed: that is reported as a failure so the
// dashboard shows it instead of a green source with no items.
export async function fetchAnthropicNews(limit: number): Promise<FetchSourceResult[]> {
  const sourceId = "anthropic";
  const label = "Anthropic";
  try {
    const res = await fetchWithTimeout(NEWS_URL);
    if (!res.ok) throw new Error(`Anthropic news page returned ${res.status}`);
    const entries = parseAnthropicNews(await res.text());
    if (entries.length === 0) {
      throw new Error("Anthropic news: 0 entries parsed, layout changed?");
    }

    const items: FeedItem[] = entries.map((e) => ({
      id: `anthropic:/news/${e.slug}`,
      source: label,
      sourceId,
      sourceType: "rss",
      title: e.title,
      url: e.url,
      summary: e.summary,
      publishedAt: e.publishedAt ?? new Date().toISOString(),
    }));

    return [{ sourceId, label, items: items.slice(0, limit), ok: true }];
  } catch (err) {
    console.error("[anthropic] failed to fetch news:", err);
    return [{ sourceId, label, items: [], ok: false, error: errorMessage(err) }];
  }
}
