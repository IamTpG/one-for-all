import { CACHE_TTL_MS } from "@/lib/config";
import { fetchAnthropicNews } from "@/lib/fetchers/anthropic";
import { fetchGithubReleases, fetchGithubTrending } from "@/lib/fetchers/github";
import { fetchHnItems } from "@/lib/fetchers/hn";
import { fetchRssItems } from "@/lib/fetchers/rss";
import type { FeedItem } from "@/lib/types";

let cache: { items: FeedItem[]; fetchedAt: number } | null = null;

export async function getAggregatedFeed(): Promise<{ items: FeedItem[]; fetchedAt: number }> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const [rss, anthropic, hn, trending, releases] = await Promise.all([
    fetchRssItems(),
    fetchAnthropicNews(),
    fetchHnItems(),
    fetchGithubTrending(),
    fetchGithubReleases(),
  ]);

  const items = [...rss, ...anthropic, ...hn, ...trending, ...releases].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  cache = { items, fetchedAt: Date.now() };
  return cache;
}
