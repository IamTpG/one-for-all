import { AI_BACKFILL_BATCH_SIZE, AI_CACHE_TTL_SECONDS, AI_CONCURRENCY } from "@/lib/config";
import { recordBackfillTick, recordGroqFailure } from "@/lib/dashboardStats";
import { classifyAndSummarize } from "@/lib/groq";
import { matchKeywordTopics } from "@/lib/keywordTopics";
import {
  deleteHashFields,
  getCachedAnalyses,
  getHashAll,
  getJson,
  setCachedAnalysis,
  setHashFields,
  setIfNotExists,
  setJson,
} from "@/lib/redis";
import type { FeedItem } from "@/lib/types";

const ITEMS_KEY = "wire:items";
const LAST_FETCH_KEY = "wire:lastFetchAt";

// Extends FeedItem with when it was first ever fetched — set once, never
// touched again. This is internal bookkeeping for the retention rule, not
// part of the public FeedItem shape sent to pages.
type StoredItem = FeedItem & { firstSeenAt: number };

function stripInternalFields(item: StoredItem): FeedItem {
  const rest: Partial<StoredItem> = { ...item };
  delete rest.firstSeenAt;
  return rest as FeedItem;
}

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
export function filterByWatchedRepos(items: FeedItem[], repos: string[]): FeedItem[] {
  const allowed = new Set(repos);
  return items.filter((item) => {
    const repo = releaseRepoFromId(item.id);
    return repo === null || allowed.has(repo);
  });
}

export async function getStoredItems(): Promise<FeedItem[]> {
  const stored = await getHashAll<StoredItem>(ITEMS_KEY);
  return sortByDateDesc(Array.from(stored.values()).map(stripInternalFields));
}

export async function getStoredItemById(id: string, watchedRepos: string[]): Promise<FeedItem | null> {
  const items = filterByWatchedRepos(await getStoredItems(), watchedRepos);
  return items.find((item) => item.id === id) ?? null;
}

export async function getLastFetchAt(): Promise<number | null> {
  return getJson<number>(LAST_FETCH_KEY);
}

// Merges a fresh fetch into the persistent store. An item is kept if EITHER
// it's still within `retentionDays` of when it was first seen, OR it's
// present in this cycle's fresh results — dropped only when both fail.
// firstSeenAt is set once and never touched again. Cost is proportional to
// this cycle's fetch size, not the whole store: items retained purely by
// the time window (absent from this cycle's fetch) are left untouched, no
// read-modify-write.
export async function mergeFreshItems(fresh: FeedItem[], retentionDays: number): Promise<void> {
  const existing = await getHashAll<StoredItem>(ITEMS_KEY);
  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

  // Reuses the same analysis cache the backfill tick writes to, so an item
  // that ages out of the store and later reappears (an HN id resurfacing, a
  // re-fetched release) can skip a redundant Groq call.
  const cached = await getCachedAnalyses(fresh.map((item) => item.id));

  const toWrite: Record<string, StoredItem> = {};
  for (const item of fresh) {
    const keywordTopics = matchKeywordTopics(`${item.title} ${item.summary ?? ""}`);
    const hit = cached.get(item.id);
    const enriched: FeedItem = hit
      ? {
          ...item,
          summary: hit.summary,
          aiSummary: true,
          topics: Array.from(new Set([...keywordTopics, ...hit.topics])),
          titleVi: hit.titleVi,
          summaryVi: hit.summaryVi,
        }
      : { ...item, topics: keywordTopics };

    const firstSeenAt = existing.get(item.id)?.firstSeenAt ?? now;
    toWrite[item.id] = { ...enriched, firstSeenAt };
  }
  await setHashFields(ITEMS_KEY, toWrite);

  const freshIds = new Set(fresh.map((item) => item.id));
  const toDrop: string[] = [];
  for (const [id, stored] of existing) {
    if (freshIds.has(id)) continue; // just (re)written above
    const withinGracePeriod = now - stored.firstSeenAt < retentionMs;
    if (!withinGracePeriod) toDrop.push(id);
  }
  if (toDrop.length > 0) await deleteHashFields(ITEMS_KEY, toDrop);

  await setJson(LAST_FETCH_KEY, now);
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

function itemsNeedingAi(stored: Map<string, StoredItem>): [string, StoredItem][] {
  return Array.from(stored.entries()).filter(([, item]) => !item.titleVi || !item.summaryVi);
}

// Count of items still missing a Vietnamese translation, for the dashboard
// backlog stat — same filter runAiBackfillTick uses, without the batch slice.
export async function getAiBacklogSize(): Promise<number> {
  const stored = await getHashAll<StoredItem>(ITEMS_KEY);
  return itemsNeedingAi(stored).length;
}

// Processes one bounded batch of stored items still missing a Vietnamese
// translation. Decoupled entirely from fetching — driven by the cron tick,
// so translation keeps progressing between scheduled fetches instead of
// waiting on the next one (or a page view, as it used to).
export async function runAiBackfillTick(
  batchSize: number = AI_BACKFILL_BATCH_SIZE
): Promise<{ processed: number }> {
  const stored = await getHashAll<StoredItem>(ITEMS_KEY);
  const needsAi = itemsNeedingAi(stored).slice(0, batchSize);

  if (needsAi.length === 0) return { processed: 0 };

  const updates: Record<string, StoredItem> = {};
  const failures: { itemId: string; message: string }[] = [];
  await withConcurrency(needsAi, AI_CONCURRENCY, async ([id, item]) => {
    const { data: result, error } = await classifyAndSummarize(item);
    if (error) failures.push({ itemId: id, message: error });
    if (!result) return;
    await setCachedAnalysis(id, result, AI_CACHE_TTL_SECONDS);
    updates[id] = {
      ...item,
      summary: result.summary,
      aiSummary: true,
      topics: Array.from(new Set([...(item.topics ?? []), ...result.topics])),
      titleVi: result.titleVi,
      summaryVi: result.summaryVi,
    };
  });

  if (Object.keys(updates).length > 0) await setHashFields(ITEMS_KEY, updates);

  const ts = Date.now();
  await Promise.all([
    recordBackfillTick({ ts, processed: Object.keys(updates).length, failureCount: failures.length }),
    ...failures.map((f) => recordGroqFailure({ ts, stage: "classify" as const, ...f })),
  ]);

  return { processed: Object.keys(updates).length };
}

// Atomic "has this scheduled slot already run today" claim — guards against
// two near-simultaneous cron invocations (or a manual Fetch-now overlapping
// a scheduled tick) both deciding a fetch is due and running it twice.
export async function markSlotRan(dateKey: string, slotUtc: string): Promise<boolean> {
  const ONE_DAY_PLUS_BUFFER_SECONDS = 25 * 60 * 60;
  return setIfNotExists(`wire:cron:ran:${dateKey}:${slotUtc}`, ONE_DAY_PLUS_BUFFER_SECONDS);
}
