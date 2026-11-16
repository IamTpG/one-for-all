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

const LAST_VISIT_KEY = "oneforall-last-visit";
const BASELINE_KEY = "oneforall-visit-baseline";

export type VisitInfo = { baseline: number | null };

let visitInfo: VisitInfo | null = null;

// The baseline is fixed once per tab session: the previous visit's time is
// read the first time the feed renders in a session and then kept, so
// opening an article and coming back does not wipe the "new" marks.
function readVisit(): VisitInfo {
  if (visitInfo) return visitInfo;
  let baseline: number | null = null;
  try {
    const session = sessionStorage.getItem(BASELINE_KEY);
    if (session !== null) {
      baseline = session === "none" ? null : Number(session) || null;
    } else {
      const last = localStorage.getItem(LAST_VISIT_KEY);
      baseline = last ? Number(last) || null : null;
      sessionStorage.setItem(BASELINE_KEY, baseline === null ? "none" : String(baseline));
      localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    }
  } catch {
    baseline = null;
  }
  visitInfo = { baseline };
  return visitInfo;
}

// Called when the reader leaves (pagehide / tab hidden), so the next
// session's baseline is the end of this one, not its start.
export function touchLastVisit() {
  try {
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
  } catch {
    // Storage blocked — the next visit simply counts as a first visit.
  }
}

const noopSubscribe = () => () => {};

// null on the server and during hydration; the client value right after.
export function useVisit(): VisitInfo | null {
  return useSyncExternalStore(noopSubscribe, readVisit, () => null);
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
