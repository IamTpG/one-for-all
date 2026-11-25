import { AI_BACKFILL_BATCH_SIZE, AI_CACHE_TTL_SECONDS, AI_CONCURRENCY } from "@/lib/config";
import { recordBackfillTick, recordGroqFailure } from "@/lib/dashboardStats";
import { classifyAndSummarize } from "@/lib/groq";
import { enforceGroqBudget } from "@/lib/usage";
import { matchKeywordTopics, sourceTopics } from "@/lib/keywordTopics";
import { mergeOfficialAnalysis } from "@/lib/official/analysis";
import { isWithinRetention, retentionDaysFor, withOfficialRepos, type RetentionDays } from "@/lib/official/filters";
import { OFFICIAL_REPOS, officialMergeContext } from "@/lib/official/sources";
import {
  addToSet,
  deleteHashFields,
  getCachedAnalyses,
  getHashAll,
  getHashAllOrNull,
  getHashFieldsOrNull,
  getJson,
  getSetMembersOrNull,
  removeFromSet,
  setCachedAnalysis,
  setHashFields,
  setIfNotExists,
  setJson,
} from "@/lib/redis";
import type { AiAnalysis, FeedItem } from "@/lib/types";

const ITEMS_KEY = "wire:items";
const LAST_FETCH_KEY = "wire:lastFetchAt";
// Ids of stored items still missing a Vietnamese title/summary, so the
// backfill tick reads those few items instead of the whole hash. The marker
// key records that the set has been built (an empty set has no key at all,
// so the set key alone cannot tell "empty" from "never built").
const PENDING_KEY = "wire:ai:pending";
const PENDING_INIT_KEY = "wire:ai:pending:init";

// Every stored item carries when it was first ever fetched — set once,
// never touched again. It drives the retention rule, and the home feed
// reads it to tell what is new since a reader's last visit.
type StoredItem = FeedItem & { firstSeenAt: number };

function mergeTopics(...lists: string[][]): string[] {
  return Array.from(new Set(lists.flat()));
}

// The single rule for an item's topics: source-implied topics, plus Groq's
// classification when one exists, otherwise the provisional keyword match.
function recomputeTopics(item: FeedItem, analysis: AiAnalysis | undefined): string[] {
  return mergeTopics(
    sourceTopics(item),
    analysis
      ? analysis.topics
      : matchKeywordTopics(`${item.title} ${item.summary ?? ""}`, {
          assumeAiContext: Boolean(item.official?.kind),
        })
  );
}

// Groq's answer for an official item can change its kind (a keyword guess
// corrected, a customer story dropped to a regular item) and adds its
// headline, availability, effective date and launch key.
function withOfficial(item: FeedItem, analysis: AiAnalysis | undefined): FeedItem["official"] {
  return mergeOfficialAnalysis(item.official, analysis, officialMergeContext(item));
}

function sameTopics(a: string[], b: string[] | undefined): boolean {
  const setB = new Set(b ?? []);
  return a.length === setB.size && a.every((topic) => setB.has(topic));
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
  const allowed = new Set(withOfficialRepos(repos, Object.keys(OFFICIAL_REPOS)));
  return items.filter((item) => {
    const repo = releaseRepoFromId(item.id);
    return repo === null || allowed.has(repo);
  });
}

export async function getStoredItems(): Promise<FeedItem[]> {
  const stored = await getHashAll<StoredItem>(ITEMS_KEY);
  return sortByDateDesc(Array.from(stored.values()));
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
// Official product updates use their own (longer) retention window.
// firstSeenAt is set once and never touched again. Cost is proportional to
// this cycle's fetch size, not the whole store: items retained purely by
// the time window (absent from this cycle's fetch) are only rewritten when
// their topics change (see recomputeTopics) — no other read-modify-write.
export async function mergeFreshItems(
  fresh: FeedItem[],
  retention: RetentionDays
): Promise<{ newItems: number; newBySource: Record<string, number>; ok: boolean }> {
  const existing = await getHashAllOrNull<StoredItem>(ITEMS_KEY);
  // A failed read must not look like an empty store: every item would count
  // as new and nothing could be dropped. Skip this merge instead.
  if (!existing) return { newItems: 0, newBySource: {}, ok: false };
  const now = Date.now();

  // Reuses the same analysis cache the backfill tick writes to, so an item
  // that ages out of the store and later reappears (an HN id resurfacing, a
  // re-fetched release) can skip a redundant Groq call.
  // Also covers every stored item, so their topics can be recomputed below.
  const cached = await getCachedAnalyses(
    Array.from(new Set([...fresh.map((item) => item.id), ...existing.keys()]))
  );

  const toWrite: Record<string, StoredItem> = {};
  const newIds = new Set<string>();
  const newBySource: Record<string, number> = {};
  for (const item of fresh) {
    if (!existing.has(item.id) && !newIds.has(item.id)) {
      newIds.add(item.id);
      newBySource[item.sourceId] = (newBySource[item.sourceId] ?? 0) + 1;
    }
    const hit = cached.get(item.id);
    const enriched: FeedItem = hit
      ? {
          ...item,
          summary: hit.summary,
          aiSummary: true,
          titleVi: hit.titleVi,
          summaryVi: hit.summaryVi,
          ...(item.official ? { official: withOfficial(item, hit) } : {}),
        }
      : item;
    enriched.topics = recomputeTopics(enriched, hit);

    const firstSeenAt = existing.get(item.id)?.firstSeenAt ?? now;
    toWrite[item.id] = { ...enriched, firstSeenAt };
  }

  const freshIds = new Set(fresh.map((item) => item.id));
  const toDrop: string[] = [];
  for (const [id, stored] of existing) {
    if (freshIds.has(id)) continue; // written above
    const withinGracePeriod = isWithinRetention(
      stored.firstSeenAt,
      now,
      retentionDaysFor(stored, retention)
    );
    if (!withinGracePeriod) {
      toDrop.push(id);
      continue;
    }
    // Retained items keep whatever topics they were stored with, so a change
    // to the topic rules would otherwise only reach them once they're
    // re-fetched. Recompute (no Groq call) and rewrite only on a change.
    const topics = recomputeTopics(stored, cached.get(id));
    if (!sameTopics(topics, stored.topics)) toWrite[id] = { ...stored, topics };
  }
  const wroteItems = Object.keys(toWrite).length === 0 || (await setHashFields(ITEMS_KEY, toWrite));
  if (toDrop.length > 0) await deleteHashFields(ITEMS_KEY, toDrop);

  // Keep the pending set in step with what was just written or dropped.
  const written = Object.entries(toWrite);
  await addToSet(PENDING_KEY, written.filter(([, item]) => needsAi(item)).map(([id]) => id));
  await removeFromSet(PENDING_KEY, [
    ...toDrop,
    ...written.filter(([, item]) => !needsAi(item)).map(([id]) => id),
  ]);

  await setJson(LAST_FETCH_KEY, now);
  return { newItems: newIds.size, newBySource, ok: wroteItems };
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

function needsAi(item: Pick<FeedItem, "titleVi" | "summaryVi">): boolean {
  return !item.titleVi || !item.summaryVi;
}

// One-time build of the pending set from the whole hash (the only full read
// the backfill ever does), for stores that predate the set. Idempotent:
// SADD of ids already present changes nothing.
async function ensurePendingSet(): Promise<void> {
  if (await getJson<number>(PENDING_INIT_KEY)) return;
  const stored = await getHashAllOrNull<StoredItem>(ITEMS_KEY);
  if (!stored) return; // read failed: try again next tick, leave the marker unset
  const ids = Array.from(stored.entries()).filter(([, item]) => needsAi(item)).map(([id]) => id);
  // Mark the migration done only once the ids are really in the set (or
  // there was nothing to add).
  if (ids.length === 0 || (await addToSet(PENDING_KEY, ids))) await setJson(PENDING_INIT_KEY, 1);
}

// Official items first (the feature the owner asked for), newest first.
function byBackfillPriority(a: [string, StoredItem], b: [string, StoredItem]): number {
  const official = Number(Boolean(b[1].official)) - Number(Boolean(a[1].official));
  if (official !== 0) return official;
  return new Date(b[1].publishedAt).getTime() - new Date(a[1].publishedAt).getTime();
}

// Processes one bounded batch of stored items still missing a Vietnamese
// translation. Decoupled entirely from fetching — driven by the cron tick,
// so translation keeps progressing between scheduled fetches instead of
// waiting on the next one (or a page view, as it used to).
export async function runAiBackfillTick(
  batchSize: number = AI_BACKFILL_BATCH_SIZE
): Promise<{ processed: number }> {
  await ensurePendingSet();
  const pendingIds = await getSetMembersOrNull(PENDING_KEY);
  if (!pendingIds || pendingIds.length === 0) return { processed: 0 };

  const stored = await getHashFieldsOrNull<StoredItem>(ITEMS_KEY, pendingIds);
  // A failed read says nothing about the items: skip the tick rather than
  // treat every pending id as stale and empty the set.
  if (!stored) return { processed: 0 };
  // Ids whose item is gone (aged out) or already translated are stale.
  const stale = pendingIds.filter((id) => {
    const item = stored.get(id);
    return !item || !needsAi(item);
  });
  if (stale.length > 0) await removeFromSet(PENDING_KEY, stale);

  const candidates = Array.from(stored.entries()).filter(([, item]) => needsAi(item));
  const batch = candidates.sort(byBackfillPriority).slice(0, batchSize);

  if (batch.length === 0) return { processed: 0 };
  // Daily cap reached (or nearly): leave the backlog for after the reset
  // rather than sending calls that can only come back as 429s.
  if (process.env.GROQ_API_KEY && (await enforceGroqBudget())) return { processed: 0 };

  const updates: Record<string, StoredItem> = {};
  const failures: { itemId: string; message: string }[] = [];
  await withConcurrency(batch, AI_CONCURRENCY, async ([id, item]) => {
    const { data: result, error } = await classifyAndSummarize(item);
    if (error) failures.push({ itemId: id, message: error });
    if (!result) return;
    await setCachedAnalysis(id, result, AI_CACHE_TTL_SECONDS);
    updates[id] = {
      ...item,
      summary: result.summary,
      aiSummary: true,
      // Groq's topics replace the provisional keyword ones rather than
      // adding to them — otherwise a keyword false positive could never be
      // corrected.
      topics: mergeTopics(sourceTopics(item), result.topics),
      titleVi: result.titleVi,
      summaryVi: result.summaryVi,
      ...(item.official ? { official: withOfficial(item, result) } : {}),
    };
  });

  if (Object.keys(updates).length > 0) {
    await setHashFields(ITEMS_KEY, updates);
    await removeFromSet(
      PENDING_KEY,
      Object.entries(updates).filter(([, item]) => !needsAi(item)).map(([id]) => id)
    );
  }

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
