import { AI_BATCH_LIMIT, AI_CACHE_TTL_SECONDS, AI_CONCURRENCY, CACHE_TTL_MS } from "@/lib/config";
import { fetchAnthropicNews } from "@/lib/fetchers/anthropic";
import { fetchGithubReleases, fetchGithubTrending } from "@/lib/fetchers/github";
import { fetchHnItems } from "@/lib/fetchers/hn";
import { fetchRssItems } from "@/lib/fetchers/rss";
import { classifyAndSummarize } from "@/lib/groq";
import { matchKeywordTopics } from "@/lib/keywordTopics";
import { getCachedAnalyses, setCachedAnalysis } from "@/lib/redis";
import type { FeedItem } from "@/lib/types";

let cache: { items: FeedItem[]; fetchedAt: number } | null = null;
let refreshing: Promise<void> | null = null;

async function fetchAndMerge(): Promise<FeedItem[]> {
  const [rss, anthropic, hn, trending, releases] = await Promise.all([
    fetchRssItems(),
    fetchAnthropicNews(),
    fetchHnItems(),
    fetchGithubTrending(),
    fetchGithubReleases(),
  ]);

  return [...rss, ...anthropic, ...hn, ...trending, ...releases].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      await fn(items[index++]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Keyword tagging always runs (free, synchronous). Groq's classification
// and summary — if REDIS_URL/GROQ_API_KEY are configured — add to that,
// looked up in one batched call and only computed once per item ever
// (cached in Redis), never re-run for items already seen.
async function enrichWithTopicsAndSummaries(items: FeedItem[]): Promise<FeedItem[]> {
  const withKeywords = items.map((item) => ({
    ...item,
    topics: matchKeywordTopics(`${item.title} ${item.summary ?? ""}`),
  }));

  const cached = await getCachedAnalyses(withKeywords.map((item) => item.id));

  const enriched = withKeywords.map((item) => {
    const hit = cached.get(item.id);
    if (!hit) return item;
    return {
      ...item,
      summary: hit.summary,
      aiSummary: true,
      topics: Array.from(new Set([...item.topics, ...hit.topics])),
    };
  });

  const needsAi = enriched.filter((item) => !cached.has(item.id)).slice(0, AI_BATCH_LIMIT);

  await withConcurrency(needsAi, AI_CONCURRENCY, async (item) => {
    const result = await classifyAndSummarize(item);
    if (!result) return;
    await setCachedAnalysis(item.id, result, AI_CACHE_TTL_SECONDS);
    item.summary = result.summary;
    item.aiSummary = true;
    item.topics = Array.from(new Set([...item.topics, ...result.topics]));
  });

  return enriched;
}

async function refresh(): Promise<void> {
  const merged = await fetchAndMerge();
  const items = await enrichWithTopicsAndSummaries(merged);
  cache = { items, fetchedAt: Date.now() };
}

export async function getAggregatedFeed(): Promise<{ items: FeedItem[]; fetchedAt: number }> {
  if (!cache) {
    // Cold start: nothing to serve yet, this request has to wait.
    await refresh();
    return cache!;
  }

  const isStale = Date.now() - cache.fetchedAt >= CACHE_TTL_MS;
  if (isStale && !refreshing) {
    // Stale-while-revalidate: serve what we have immediately, refresh in
    // the background so the AI calls in enrichWithTopicsAndSummaries never
    // add latency to a real request.
    refreshing = refresh()
      .catch((err) => console.error("[aggregate] background refresh failed:", err))
      .finally(() => {
        refreshing = null;
      });
  }

  return cache;
}

export async function getFeedItemById(id: string): Promise<FeedItem | null> {
  const { items } = await getAggregatedFeed();
  return items.find((item) => item.id === id) ?? null;
}
