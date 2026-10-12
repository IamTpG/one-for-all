import { cache } from "react";
import { GROQ_LIMITS, UPSTASH_LIMITS } from "@/lib/config";
import {
  getBackfillHistory,
  getGroqFailures,
  getHomeViewsDaily,
  getHomeViewStats,
  getItemViewCounts,
  getLanguageToggleStats,
  getRecentRuns,
  getRecentTicks,
  getTickStats,
  pingRedis,
} from "@/lib/dashboardStats";
import { evaluateStatus, type StatusResult } from "@/lib/dashboardStatus";
import { fetchGithubSearchRateLimit } from "@/lib/fetchers/github";
import { latestDueSlot, slotDateKey, utcToIct } from "@/lib/schedule";
import { getSiteSettings } from "@/lib/siteSettings";
import { getStoredItems } from "@/lib/store";
import { getUpstashUsage } from "@/lib/upstashUsage";
import { getGroqUsage } from "@/lib/usage";

// Per-request memoised loaders for the dashboard. The status banner and the
// active tab both need some of the same data, and React's `cache` makes each
// loader run once per request, so a section can call any of these freely.

export const loadSettings = cache(() => getSiteSettings());
export const loadRuns = cache(() => getRecentRuns());
export const loadTicks = cache(() => getRecentTicks());
export const loadTickStats = cache(() => getTickStats());
export const loadBackfillHistory = cache(() => getBackfillHistory());
export const loadGroqFailures = cache(() => getGroqFailures());
export const loadStoredItems = cache(() => getStoredItems());
export const loadRedisUp = cache(() => pingRedis());
export const loadGroqUsage = cache(() => getGroqUsage());
export const loadUpstashUsage = cache(() => getUpstashUsage());
export const loadHomeViews = cache(() => getHomeViewStats());
export const loadHomeViewsDaily = cache(() => getHomeViewsDaily());
export const loadItemViewCounts = cache(() => getItemViewCounts());
export const loadToggleStats = cache(() => getLanguageToggleStats());
export const loadGithubRateLimit = cache(() => fetchGithubSearchRateLimit());

// Items still missing a Vietnamese title or summary — the same rule the
// backfill tick uses (store.ts itemsNeedingAi), derived from the item list the
// dashboard already loads instead of reading the whole Redis hash a second time.
export const loadBacklogSize = cache(async () => {
  const items = await loadStoredItems();
  return items.filter((item) => !item.titleVi || !item.summaryVi).length;
});

// The most recent scheduled fetch slot that should have run by now, and
// whether a fetch run was recorded for it.
function dueSlotInfo(
  now: number,
  slotsUtc: string[],
  runs: { slot: string | null; ts: number }[]
): { ts: number; label: string; ran: boolean } | null {
  const slot = latestDueSlot(new Date(now), slotsUtc);
  if (!slot) return null;
  const ts = Date.parse(`${slotDateKey(new Date(now), slot)}T${slot}:00Z`);
  return { ts, label: `${utcToIct(slot)} ICT`, ran: runs.some((run) => run.slot === slot && run.ts >= ts) };
}

export const loadStatus = cache(async (): Promise<StatusResult> => {
  const now = Date.now();
  const [settings, runs, ticks, backlog, redisUp, groq, upstash] = await Promise.all([
    loadSettings(),
    loadRuns(),
    loadTicks(),
    loadBacklogSize(),
    loadRedisUp(),
    loadGroqUsage(),
    loadUpstashUsage(),
  ]);

  const latestRun = runs[0] ?? null;
  let upstashBandwidthPercent: number | null = null;
  if (upstash.status === "ok") {
    const { monthBytes, projectedMonthBytes } = upstash.data.bandwidth;
    upstashBandwidthPercent = (Math.max(monthBytes, projectedMonthBytes ?? 0) / UPSTASH_LIMITS.bandwidthBytesPerMonth) * 100;
  }

  return evaluateStatus({
    now,
    redisUp,
    lastTickTs: ticks[0]?.ts ?? null,
    longestTickMs: ticks.length > 0 ? Math.max(...ticks.map((t) => t.durationMs)) : null,
    dueSlot: dueSlotInfo(now, settings.fetchTimesUtc, runs),
    lastRunTs: latestRun?.ts ?? null,
    sourcesFailed: latestRun ? latestRun.sources.filter((s) => !s.ok).length : 0,
    sourcesTotal: latestRun ? latestRun.sources.length : 0,
    backlog,
    groqTokensPercent: (groq.today.tokens / GROQ_LIMITS.tokensPerDay) * 100,
    upstashBandwidthPercent,
  });
});
