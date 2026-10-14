import {
  CRON_TICK_INTERVAL_MINUTES,
  DASHBOARD_BACKFILL_HISTORY_LIMIT,
  DASHBOARD_GROQ_FAILURE_LIMIT,
  DASHBOARD_RUN_HISTORY_LIMIT,
  DASHBOARD_TICK_COUNT_RETENTION_DAYS,
  DASHBOARD_TICK_DAILY_RETENTION_DAYS,
  DASHBOARD_TICK_HISTORY_LIMIT,
  DASHBOARD_VIEWS_CHART_DAYS,
} from "@/lib/config";
import { getCappedList, getHashAll, incrHashField, incrHashFields, pingRedis, pushCapped } from "@/lib/redis";

const RUNS_KEY = "wire:runs";
const TICKS_KEY = "wire:cron:ticks";
const TICK_COUNT_KEY_PREFIX = "wire:cron:count:";
const TICK_DAILY_KEY = "wire:cron:daily";
const BACKFILL_HISTORY_KEY = "wire:backfill:history";
const GROQ_FAILURES_KEY = "wire:groq:failures";
const HOME_VIEWS_KEY = "wire:views:home";
const ITEM_VIEWS_KEY = "wire:views:items";
const TOGGLE_VIEWS_KEY = "wire:views:toggle";

export type FetchRunSourceResult = {
  sourceId: string;
  label: string;
  count: number;
  // Items from this source not already in the store. Absent on older runs.
  newItems?: number;
  ok: boolean;
  error?: string;
};

export type FetchRunRecord = {
  ts: number;
  slot: string | null; // null = manual "Fetch now"
  durationMs: number;
  totalFetched: number;
  // Items not already in the store. Absent on runs recorded before this was tracked.
  newItems?: number;
  sources: FetchRunSourceResult[];
};

export type BackfillTickRecord = {
  ts: number;
  processed: number;
  failureCount: number;
};

export type GroqFailureRecord = {
  ts: number;
  stage: "classify" | "translate";
  itemId: string;
  message: string;
};

// One entry per /api/cron/tick invocation that got past auth. Written when
// the tick finishes, so a tick killed by the function timeout leaves no
// record — which shows up as a stale "last tick" on the dashboard.
export type TickRecord = {
  ts: number;
  durationMs: number;
  fetched: number | null; // null = no fetch slot was due this tick
  backfillProcessed: number;
  groq429: number; // rate-limited Groq responses seen during this tick
};

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function recordTick(record: TickRecord): Promise<void> {
  await Promise.all([
    pushCapped(TICKS_KEY, record, DASHBOARD_TICK_HISTORY_LIMIT),
    incrHashFields(
      TICK_COUNT_KEY_PREFIX + utcDayKey(record.ts),
      { count: 1 },
      DASHBOARD_TICK_COUNT_RETENTION_DAYS * 24 * 60 * 60
    ),
    // One field per day in a single hash, so the heatmap reads it in one call.
    // The TTL is refreshed on every tick, so the hash only expires if ticks stop.
    incrHashFields(
      TICK_DAILY_KEY,
      { [utcDayKey(record.ts)]: 1 },
      DASHBOARD_TICK_DAILY_RETENTION_DAYS * 24 * 60 * 60
    ),
  ]);
}

export async function getRecentTicks(limit: number = DASHBOARD_TICK_HISTORY_LIMIT): Promise<TickRecord[]> {
  return getCappedList<TickRecord>(TICKS_KEY, limit);
}

// Ticks received so far this UTC day, against how many a steady cron would
// have delivered by now (the cron fires on the interval, aligned to 00:00 UTC).
export async function getTickStats(): Promise<{ ticksToday: number; expectedSoFar: number }> {
  const now = Date.now();
  const raw = await getHashAll<number>(TICK_COUNT_KEY_PREFIX + utcDayKey(now));
  const minutesIntoDay = Math.floor((now % (24 * 60 * 60 * 1000)) / 60000);
  return {
    ticksToday: raw.get("count") ?? 0,
    expectedSoFar: Math.floor(minutesIntoDay / CRON_TICK_INTERVAL_MINUTES) + 1,
  };
}

// Ticks received per UTC day for the last `days` days, oldest first, zero-filled.
export async function getTickCountsDaily(days: number): Promise<{ date: string; count: number }[]> {
  const raw = await getHashAll<number>(TICK_DAILY_KEY);
  const series: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = utcDayKey(Date.now() - i * 24 * 60 * 60 * 1000);
    series.push({ date, count: raw.get(date) ?? 0 });
  }
  return series;
}

export async function recordFetchRun(record: FetchRunRecord): Promise<void> {
  await pushCapped(RUNS_KEY, record, DASHBOARD_RUN_HISTORY_LIMIT);
}

export async function getRecentRuns(limit: number = DASHBOARD_RUN_HISTORY_LIMIT): Promise<FetchRunRecord[]> {
  return getCappedList<FetchRunRecord>(RUNS_KEY, limit);
}

export async function recordBackfillTick(record: BackfillTickRecord): Promise<void> {
  await pushCapped(BACKFILL_HISTORY_KEY, record, DASHBOARD_BACKFILL_HISTORY_LIMIT);
}

export async function getBackfillHistory(
  limit: number = DASHBOARD_BACKFILL_HISTORY_LIMIT
): Promise<BackfillTickRecord[]> {
  return getCappedList<BackfillTickRecord>(BACKFILL_HISTORY_KEY, limit);
}

export async function recordGroqFailure(record: GroqFailureRecord): Promise<void> {
  await pushCapped(GROQ_FAILURES_KEY, record, DASHBOARD_GROQ_FAILURE_LIMIT);
}

export async function getGroqFailures(
  limit: number = DASHBOARD_GROQ_FAILURE_LIMIT
): Promise<GroqFailureRecord[]> {
  return getCappedList<GroqFailureRecord>(GROQ_FAILURES_KEY, limit);
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordHomeView(): Promise<void> {
  await Promise.all([
    incrHashField(HOME_VIEWS_KEY, "total"),
    incrHashField(HOME_VIEWS_KEY, todayDateKey()),
  ]);
}

export async function getHomeViewStats(): Promise<{ total: number; today: number }> {
  const raw = await getHashAll<number>(HOME_VIEWS_KEY);
  return {
    total: raw.get("total") ?? 0,
    today: raw.get(todayDateKey()) ?? 0,
  };
}

// Daily view counts for the last `days` days, oldest first, zero-filled for
// days with no recorded views — recordHomeView already writes one field per
// calendar date (alongside "total"), this just reads that back as a series.
export async function getHomeViewsDaily(
  days: number = DASHBOARD_VIEWS_CHART_DAYS
): Promise<{ date: string; count: number }[]> {
  const raw = await getHashAll<number>(HOME_VIEWS_KEY);
  const series: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    series.push({ date, count: raw.get(date) ?? 0 });
  }
  return series;
}

export async function recordItemView(itemId: string): Promise<void> {
  await incrHashField(ITEM_VIEWS_KEY, itemId);
}

export async function getItemViewCounts(): Promise<Map<string, number>> {
  return getHashAll<number>(ITEM_VIEWS_KEY);
}

export async function recordLanguageToggle(lang: "en" | "vi"): Promise<void> {
  await incrHashField(TOGGLE_VIEWS_KEY, lang);
}

export async function getLanguageToggleStats(): Promise<{ en: number; vi: number }> {
  const raw = await getHashAll<number>(TOGGLE_VIEWS_KEY);
  return { en: raw.get("en") ?? 0, vi: raw.get("vi") ?? 0 };
}

export { pingRedis };
