import {
  DASHBOARD_BACKFILL_HISTORY_LIMIT,
  DASHBOARD_GROQ_FAILURE_LIMIT,
  DASHBOARD_RUN_HISTORY_LIMIT,
} from "@/lib/config";
import { getCappedList, getHashAll, incrHashField, pingRedis, pushCapped } from "@/lib/redis";

const RUNS_KEY = "wire:runs";
const BACKFILL_HISTORY_KEY = "wire:backfill:history";
const GROQ_FAILURES_KEY = "wire:groq:failures";
const HOME_VIEWS_KEY = "wire:views:home";
const ITEM_VIEWS_KEY = "wire:views:items";
const TOGGLE_VIEWS_KEY = "wire:views:toggle";

export type FetchRunSourceResult = {
  sourceId: string;
  label: string;
  count: number;
  ok: boolean;
  error?: string;
  meta?: Record<string, string | number>;
};

export type FetchRunRecord = {
  ts: number;
  slot: string | null; // null = manual "Fetch now"
  durationMs: number;
  totalFetched: number;
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
