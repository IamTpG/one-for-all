import { AI_BATCH_LIMIT, AI_CACHE_TTL_SECONDS, AI_CONCURRENCY, CACHE_TTL_MS } from "@/lib/config";
import { fetchAnthropicNews } from "@/lib/fetchers/anthropic";
import { fetchGithubReleases, fetchGithubTrending } from "@/lib/fetchers/github";
import { fetchHnItems } from "@/lib/fetchers/hn";
import { fetchRssItems } from "@/lib/fetchers/rss";
import { classifyAndSummarize } from "@/lib/groq";
import { matchKeywordTopics } from "@/lib/keywordTopics";
import { getCachedAnalyses, setCachedAnalysis } from "@/lib/redis";
import type { FeedItem } from "@/lib/types";

// fetchedRepos is every repo whose releases are currently represented in
// `items` — a superset that only ever grows (repos aren't dropped from it
// just because they've since been unwatched; see filterByWatchedRepos).
// This decouples "what's been fetched" from "what the caller currently
// wants displayed," so unwatching a repo never needs a fetch at all, and
// watching a new one only ever needs a small targeted fetch for that repo
// instead of re-running the whole pipeline.
let cache: { items: FeedItem[]; fetchedAt: number; fetchedRepos: string[] } | null = null;
let refreshing: Promise<void> | null = null;
let addingRepos: Promise<void> | null = null;

function sortByDateDesc(items: FeedItem[]): FeedItem[] {
  return [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function releaseRepoFromId(id: string): string | null {
  if (!id.startsWith("gh-release:")) return null;
  const [, repo] = id.split(":");
  return repo ?? null;
}

// Only github-release items are repo-scoped; everything else (RSS, HN,
// trending, Anthropic) passes through untouched.
function filterByWatchedRepos(items: FeedItem[], repos: string[]): FeedItem[] {
  const allowed = new Set(repos);
  return items.filter((item) => {
    const repo = releaseRepoFromId(item.id);
    return repo === null || allowed.has(repo);
  });
}

async function fetchAndMerge(repos: string[]): Promise<FeedItem[]> {
  const [rss, anthropic, hn, trending, releases] = await Promise.all([
    fetchRssItems(),
    fetchAnthropicNews(),
    fetchHnItems(),
    fetchGithubTrending(),
    fetchGithubReleases(repos),
  ]);

  return sortByDateDesc([...rss, ...anthropic, ...hn, ...trending, ...releases]);
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

// Keyword tagging always runs (free, synchronous). Groq's classification,
// summary, and Vietnamese translation — if REDIS_URL/GROQ_API_KEY are
// configured — add to that, looked up in one batched call. An item is
// reprocessed only if it's never been analyzed at all, or if it's missing
// the Vietnamese fields added after it was first cached (a one-time
// backfill for anything cached before translation existed, naturally
// throttled by AI_BATCH_LIMIT/AI_CONCURRENCY the same as fresh items
// instead of a 90-day wait or a Groq-hammering burst).
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
      titleVi: hit.titleVi,
      summaryVi: hit.summaryVi,
    };
  });

  const needsAi = enriched
    .filter((item) => {
      const hit = cached.get(item.id);
      return !hit || !hit.titleVi || !hit.summaryVi;
    })
    .slice(0, AI_BATCH_LIMIT);

  await withConcurrency(needsAi, AI_CONCURRENCY, async (item) => {
    const result = await classifyAndSummarize(item);
    if (!result) return;
    await setCachedAnalysis(item.id, result, AI_CACHE_TTL_SECONDS);
    item.summary = result.summary;
    item.aiSummary = true;
    item.topics = Array.from(new Set([...item.topics, ...result.topics]));
    if (result.titleVi) item.titleVi = result.titleVi;
    if (result.summaryVi) item.summaryVi = result.summaryVi;
  });

  return enriched;
}

async function refresh(repos: string[]): Promise<void> {
  const merged = await fetchAndMerge(repos);
  const items = await enrichWithTopicsAndSummaries(merged);
  cache = { items, fetchedAt: Date.now(), fetchedRepos: repos };
}

// Fetches releases for just the given (previously-unseen) repos and merges
// them into the existing cache, leaving fetchedAt and every other source's
// items untouched — used when watching a new repo shouldn't cost a full
// pipeline re-run.
async function addRepos(repos: string[]): Promise<void> {
  if (!cache) return;
  const releases = await fetchGithubReleases(repos);
  const enriched = await enrichWithTopicsAndSummaries(releases);
  cache = {
    items: sortByDateDesc([...cache.items, ...enriched]),
    fetchedAt: cache.fetchedAt,
    fetchedRepos: [...cache.fetchedRepos, ...repos],
  };
}

export async function getAggregatedFeed(
  repos: string[]
): Promise<{ items: FeedItem[]; fetchedAt: number }> {
  if (!cache) {
    // True cold start: nothing to serve yet, this request has to wait.
    await refresh(repos);
  } else {
    let missing = repos.filter((r) => !cache!.fetchedRepos.includes(r));
    if (missing.length > 0) {
      // Single-flight guard: if another request is already fetching new
      // repos, wait for it instead of duplicating the work, then recheck
      // — it may have already covered what this request needed.
      if (addingRepos) await addingRepos.catch(() => {});
      missing = repos.filter((r) => !cache!.fetchedRepos.includes(r));
      if (missing.length > 0) {
        addingRepos = addRepos(missing)
          .catch((err) => console.error("[aggregate] failed to add watched repos:", err))
          .finally(() => {
            addingRepos = null;
          });
        await addingRepos;
      }
    }

    const isStale = Date.now() - cache.fetchedAt >= CACHE_TTL_MS;
    if (isStale && !refreshing) {
      // Stale-while-revalidate: serve what we have immediately, refresh in
      // the background so the AI calls in enrichWithTopicsAndSummaries never
      // add latency to a real request. Refreshes the full known repo set,
      // not just the repos this particular request asked for, so a repo
      // that's since been unwatched doesn't silently go stale forever.
      refreshing = refresh(cache.fetchedRepos)
        .catch((err) => console.error("[aggregate] background refresh failed:", err))
        .finally(() => {
          refreshing = null;
        });
    }
  }

  return {
    items: filterByWatchedRepos(cache!.items, repos),
    fetchedAt: cache!.fetchedAt,
  };
}

export async function getFeedItemById(id: string, repos: string[]): Promise<FeedItem | null> {
  const { items } = await getAggregatedFeed(repos);
  return items.find((item) => item.id === id) ?? null;
}
