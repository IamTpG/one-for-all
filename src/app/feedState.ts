"use client";

import { useSyncExternalStore } from "react";
import type { FeedItem } from "@/lib/types";

// Per-reader state for the home feed, kept in this browser only: when the
// reader last visited, which items they opened, and what they saved.
// Every read and write tolerates blocked storage (private windows): the
// feed then behaves like a first visit and keeps state in memory.

type Listener = () => void;

function createLocalStore<T>(key: string, parse: (raw: string) => T, empty: T) {
  let memoryRaw: string | null = null;
  let storageWorks = true;
  let cachedRaw: string | null | undefined;
  let cached: T = empty;
  const listeners = new Set<Listener>();

  function readRaw(): string | null {
    if (!storageWorks) return memoryRaw;
    try {
      return localStorage.getItem(key);
    } catch {
      storageWorks = false;
      return memoryRaw;
    }
  }

  function get(): T {
    const raw = readRaw();
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        cached = raw ? parse(raw) : empty;
      } catch {
        cached = empty;
      }
    }
    return cached;
  }

  function write(raw: string) {
    memoryRaw = raw;
    if (storageWorks) {
      try {
        localStorage.setItem(key, raw);
      } catch {
        storageWorks = false;
      }
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { get, write, subscribe, getServer: () => empty };
}

// ---------- Last visit ----------

// A visit is a run of activity with no gap longer than VISIT_GAP_MS. Both
// keys live in localStorage, so every tab shares one visit, and a reload or
// a new tab inside the same visit keeps the same "new" marks. After a longer
// gap the next visit starts, and its baseline is when the reader was last
// active, i.e. the end of the previous visit.
const VISIT_GAP_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = "oneforall-last-activity";
const BASELINE_KEY = "oneforall-visit-baseline"; // ms, or "none" for a first visit
// Written by earlier builds at session start; read once as a fallback.
const LEGACY_LAST_VISIT_KEY = "oneforall-last-visit";

export type VisitInfo = { baseline: number | null };

let visitInfo: VisitInfo | null = null;
let memoryLastActivity: number | null = null;
const visitListeners = new Set<Listener>();

function readNumber(key: string): number | null {
  const raw = localStorage.getItem(key);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Resolves the visit for "now": continue the current one when the reader
// was active within the gap, otherwise start a new one. Records activity.
function resolveVisit(now: number): VisitInfo {
  let baseline: number | null = null;
  try {
    const lastActivity = readNumber(LAST_ACTIVITY_KEY) ?? readNumber(LEGACY_LAST_VISIT_KEY);
    const stored = localStorage.getItem(BASELINE_KEY);
    if (lastActivity !== null && now - lastActivity < VISIT_GAP_MS && stored !== null) {
      baseline = stored === "none" ? null : readNumber(BASELINE_KEY);
    } else {
      baseline = lastActivity;
      localStorage.setItem(BASELINE_KEY, baseline === null ? "none" : String(baseline));
    }
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    localStorage.removeItem(LEGACY_LAST_VISIT_KEY);
  } catch {
    // Storage blocked: one visit per page load, baseline kept in memory.
    baseline = memoryLastActivity !== null && now - memoryLastActivity >= VISIT_GAP_MS ? memoryLastActivity : null;
  }
  memoryLastActivity = now;
  return { baseline };
}

function readVisit(): VisitInfo {
  if (!visitInfo) visitInfo = resolveVisit(Date.now());
  return visitInfo;
}

// Called on reader activity (input, scroll, leaving or returning to the
// tab). If the gap since the last activity ended the visit, a new visit
// starts and subscribers re-render with the new baseline, so a tab left
// open for hours advances "since last visit" when the reader comes back.
export function touchActivity() {
  const now = Date.now();
  let lastActivity = memoryLastActivity;
  try {
    lastActivity = readNumber(LAST_ACTIVITY_KEY) ?? lastActivity;
  } catch {
    // Storage blocked: fall back to the in-memory value.
  }
  if (visitInfo && lastActivity !== null && now - lastActivity >= VISIT_GAP_MS) {
    visitInfo = resolveVisit(now);
    visitListeners.forEach((listener) => listener());
    return;
  }
  memoryLastActivity = now;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {
    // Storage blocked: activity is tracked in memory only.
  }
}

// Keeps the visit alive while the reader is on a page: resolves the visit
// now (so opening an article directly after days away starts a new one),
// then records activity on input (throttled), when the tab is hidden or
// shown, and when the page is left. Any page a reader spends time on calls
// this; otherwise a long read would end the visit and reset the feed's
// "new" marks on the way back. Returns the cleanup.
export function trackVisitActivity(onPageHide?: () => void): () => void {
  readVisit();
  let lastTouch = 0;
  function onInput() {
    const t = Date.now();
    if (t - lastTouch < 15_000) return;
    lastTouch = t;
    touchActivity();
  }
  function onHide() {
    onPageHide?.();
    touchActivity();
  }
  const inputEvents = ["pointerdown", "keydown", "scroll", "wheel"] as const;
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", touchActivity);
  inputEvents.forEach((name) => window.addEventListener(name, onInput, { passive: true }));
  return () => {
    window.removeEventListener("pagehide", onHide);
    document.removeEventListener("visibilitychange", touchActivity);
    inputEvents.forEach((name) => window.removeEventListener(name, onInput));
    touchActivity();
  };
}

function subscribeVisit(listener: Listener): () => void {
  visitListeners.add(listener);
  return () => visitListeners.delete(listener);
}

// null on the server and during hydration; the client value right after.
export function useVisit(): VisitInfo | null {
  return useSyncExternalStore(subscribeVisit, readVisit, () => null);
}

// ---------- Seen items ----------

const MAX_SEEN = 3000;
const EMPTY_SET: ReadonlySet<string> = new Set();

const seenStore = createLocalStore<ReadonlySet<string>>(
  "oneforall-seen",
  (raw) => new Set(JSON.parse(raw) as string[]),
  EMPTY_SET
);

export function useSeen(): ReadonlySet<string> {
  return useSyncExternalStore(seenStore.subscribe, seenStore.get, seenStore.getServer);
}

export function markSeen(ids: string[]) {
  const current = seenStore.get();
  if (ids.every((id) => current.has(id))) return;
  const next = [...current].filter((id) => !ids.includes(id));
  next.push(...ids);
  seenStore.write(JSON.stringify(next.slice(-MAX_SEEN)));
}

// ---------- Saved items ----------

// A snapshot, not just an id: saved items must outlive the feed's
// retention window, so they carry what the row needs to render.
export type SavedItem = Pick<
  FeedItem,
  | "id"
  | "source"
  | "sourceId"
  | "sourceType"
  | "title"
  | "titleVi"
  | "url"
  | "summary"
  | "summaryVi"
  | "publishedAt"
  | "imageUrl"
  | "topics"
  | "tag"
  | "firstSeenAt"
> & { savedAt: number };

const EMPTY_SAVED: readonly SavedItem[] = [];

const savedStore = createLocalStore<readonly SavedItem[]>(
  "oneforall-saved",
  (raw) => JSON.parse(raw) as SavedItem[],
  EMPTY_SAVED
);

export function useSaved(): readonly SavedItem[] {
  return useSyncExternalStore(savedStore.subscribe, savedStore.get, savedStore.getServer);
}

export function toggleSaved(item: FeedItem) {
  const current = savedStore.get();
  if (current.some((saved) => saved.id === item.id)) {
    savedStore.write(JSON.stringify(current.filter((saved) => saved.id !== item.id)));
    return;
  }
  const snapshot: SavedItem = {
    id: item.id,
    source: item.source,
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    title: item.title,
    titleVi: item.titleVi,
    url: item.url,
    summary: item.summary,
    summaryVi: item.summaryVi,
    publishedAt: item.publishedAt,
    imageUrl: item.imageUrl,
    topics: item.topics,
    tag: item.tag,
    firstSeenAt: item.firstSeenAt,
    savedAt: Date.now(),
  };
  savedStore.write(JSON.stringify([snapshot, ...current]));
}
