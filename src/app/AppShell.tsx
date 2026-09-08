"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChartIcon, GearIcon, LockIcon } from "@/lib/icons";
import type { ActiveFilter, FeedItem } from "@/lib/types";
import Card from "./Card";
import LanguageToggle from "./LanguageToggle";
import SidebarLeft from "./SidebarLeft";
import SidebarRight from "./SidebarRight";
import ThemeToggle from "./ThemeToggle";
import ViewTracker from "./ViewTracker";
import styles from "./AppShell.module.css";

const PAGE_SIZE = 15;

// The App Router unmounts Home when navigating to an article (this project
// doesn't have `cacheComponents` enabled, which is the flag that would keep
// it mounted via React's Activity instead) — so a plain back-navigation
// remounts AppShell from scratch and loses how far you'd scrolled. This key
// persists just enough state across that remount/reload cycle to restore it.
const HOME_STATE_KEY = "oneforall-home-scroll";

type SavedHomeState = {
  visibleCount: number;
  filter: ActiveFilter;
  scrollY: number;
};

// Read via useSyncExternalStore (below) instead of an effect + setState:
// that path applies the restored state as part of the first client render
// pass, before anything paints, so there's no visible flash of the default
// 15-item feed before it jumps to the restored one. getSnapshot must return
// a referentially stable value when nothing changed, hence the raw-string
// cache — a fresh JSON.parse() every render would look like a new value
// every time and trigger React's "getSnapshot should be cached" warning.
let cachedRawHomeState: string | null = null;
let cachedHomeState: SavedHomeState | null = null;

function getHomeStateSnapshot(): SavedHomeState | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(HOME_STATE_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRawHomeState) return cachedHomeState;
  cachedRawHomeState = raw;
  try {
    cachedHomeState = raw ? (JSON.parse(raw) as SavedHomeState) : null;
  } catch {
    cachedHomeState = null;
  }
  return cachedHomeState;
}

function getHomeStateServerSnapshot(): SavedHomeState | null {
  return null;
}

function subscribeHomeState(): () => void {
  // Nothing to subscribe to — this only needs to resolve once, right after
  // hydration swaps the server's null snapshot for the real client one.
  return () => {};
}

function timeAgo(now: number, then: number): string {
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function AppShell({
  items,
  feeds,
  isOwner,
  trendingRepos,
  topHn,
  fetchedAt,
}: {
  items: FeedItem[];
  feeds: { name: string; sourceId: string }[];
  isOwner: boolean;
  trendingRepos: FeedItem[];
  topHn: FeedItem[];
  fetchedAt: number | null;
}) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ kind: "type", value: "all" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Restore a saved feed position (e.g. after coming back from an article).
  // Applied during render rather than in an effect: getServerSnapshot
  // returns null so the server/hydration render always matches (no
  // mismatch), and the moment the client snapshot resolves, this update
  // happens synchronously before the first client paint — no visible flash
  // of the default 15-item feed before it jumps to the restored one.
  // (Refs can't be read/written during render, hence state — compared by
  // reference, since getHomeStateSnapshot caches and returns the same
  // object until sessionStorage actually changes — instead of a ref flag.)
  const savedHomeState = useSyncExternalStore(subscribeHomeState, getHomeStateSnapshot, getHomeStateServerSnapshot);
  const [appliedHomeState, setAppliedHomeState] = useState<SavedHomeState | null>(null);
  const [pendingScrollY, setPendingScrollY] = useState<number | null>(null);
  if (savedHomeState && savedHomeState !== appliedHomeState) {
    setAppliedHomeState(savedHomeState);
    setActiveFilter(savedHomeState.filter);
    setVisibleCount(savedHomeState.visibleCount);
    setPendingScrollY(savedHomeState.scrollY);
  }
  // Starts equal to fetchedAt so the first client render matches the server
  // render exactly (both show "just now"); ticks forward after mount. No
  // fetch has ever run yet if fetchedAt is null (a fresh store) — "now"
  // just doesn't matter in that case since the header shows a fixed string.
  const [now, setNow] = useState(() => fetchedAt ?? Date.now());
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // The order you're currently scrolling through, frozen independently of
  // the `items` prop. A router.refresh() (e.g. after toggling a source or
  // watched repo) re-renders this component with a freshly re-sorted
  // `items` array, which would otherwise splice new items into wherever
  // their publish date lands — including above stuff you've already
  // scrolled past. Instead, anything still present just gets its data
  // refreshed in place, anything gone disappears immediately (that's the
  // point of the toggle you just clicked), and anything genuinely new gets
  // appended to the end. A real page reload (fresh mount) just takes
  // whatever order the server gives it, no diffing involved.
  const [stableItems, setStableItems] = useState<FeedItem[]>(items);
  const previousItemsRef = useRef(items);

  useEffect(() => {
    if (items === previousItemsRef.current) return;
    previousItemsRef.current = items;

    setStableItems((prevStable) => {
      const incomingById = new Map(items.map((item) => [item.id, item]));
      const kept = prevStable
        .filter((item) => incomingById.has(item.id))
        .map((item) => incomingById.get(item.id)!);
      const keptIds = new Set(kept.map((item) => item.id));
      const appended = items.filter((item) => !keptIds.has(item.id));
      return [...kept, ...appended];
    });
  }, [items]);

  // Counts for the left sidebar's "All 142" / per-type / per-topic /
  // per-feed badges — computed off the full item set, not the current
  // filter, so a count never changes just because you clicked a filter.
  const sidebarCounts = useMemo(() => {
    const byType: Record<string, number> = { all: items.length };
    const byTopic: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const item of items) {
      byType[item.sourceType] = (byType[item.sourceType] ?? 0) + 1;
      bySource[item.sourceId] = (bySource[item.sourceId] ?? 0) + 1;
      for (const topicId of item.topics ?? []) {
        byTopic[topicId] = (byTopic[topicId] ?? 0) + 1;
      }
    }
    return { byType, byTopic, bySource };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeFilter.kind === "source") {
      return stableItems.filter((item) => item.sourceId === activeFilter.value);
    }
    if (activeFilter.kind === "topic") {
      return stableItems.filter((item) => item.topics?.includes(activeFilter.value));
    }
    if (activeFilter.value === "all") return stableItems;
    return stableItems.filter((item) => item.sourceType === activeFilter.value);
  }, [stableItems, activeFilter]);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

  function handleFilterChange(filter: ActiveFilter) {
    setActiveFilter(filter);
    setVisibleCount(PAGE_SIZE);
  }

  // Runs after the restored item count has committed to the DOM but before
  // the browser paints, so the scroll jump is never visible either. Clearing
  // pendingScrollY is deferred (like the `now` tick below) since a direct
  // setState call isn't allowed synchronously within an effect body — it
  // doesn't need to be synchronous, only the scrollTo above does.
  useLayoutEffect(() => {
    if (pendingScrollY === null) return;
    window.scrollTo(0, pendingScrollY);
    const timeout = setTimeout(() => setPendingScrollY(null), 0);
    return () => clearTimeout(timeout);
  }, [pendingScrollY, visibleItems.length]);

  // Keep the saved position current. The meaningful save is the one that
  // runs as this cleanup during the real unmount (navigating to an
  // article) — the closure then holds the last-committed visibleCount and
  // activeFilter, which is exactly what should be restored on the way back.
  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem(
          HOME_STATE_KEY,
          JSON.stringify({ visibleCount, filter: activeFilter, scrollY: window.scrollY } satisfies SavedHomeState)
        );
      } catch {
        // Private browsing / storage full — nothing to fall back to.
      }
    };
  }, [visibleCount, activeFilter]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 60000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredItems.length));
        }
      },
      { rootMargin: "800px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filteredItems.length]);

  return (
    <>
      <a href="#main-feed" className={styles.skipLink}>
        Skip to content
      </a>
      <ViewTracker type="home" />
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          {/* Plain <a>, not next/link's <Link> — Link would soft-navigate
              and no-op since we're already on "/", whereas a real anchor
              always triggers a full browser reload, refetching everything
              fresh (new items, reset scroll/pagination state). Clearing the
              saved-scroll key here too, otherwise this "fresh reload" would
              immediately restore the old position it's meant to discard. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className={styles.brand}
            onClick={() => {
              try {
                sessionStorage.removeItem(HOME_STATE_KEY);
              } catch {
                // Private browsing / storage disabled — nothing to clear.
              }
            }}
          >
            <svg className={styles.brandMark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 17 L4 9" />
              <path d="M9 17 L9 5" />
              <path d="M14 17 L14 12" />
              <path d="M19 17 L19 7" />
            </svg>
            <div className={styles.brandText}>
              <h1 className={`${styles.brandTitle} display`}>OneForAll</h1>
              <span className={`${styles.brandTagline} mono`}>AI · DEV · GITHUB</span>
            </div>
          </a>
          <div className={styles.headerRight}>
            <span className={`${styles.feedMeta} mono`}>
              <span className={styles.liveDot} aria-hidden="true" />
              {items.length} items ·{" "}
              {fetchedAt === null ? "not fetched yet" : `updated ${timeAgo(now, fetchedAt)}`}
            </span>
            {isOwner && (
              <Link href="/dashboard" className={styles.themeToggle} aria-label="Dashboard">
                <ChartIcon />
              </Link>
            )}
            {isOwner ? (
              <Link href="/settings" className={styles.themeToggle} aria-label="Settings">
                <GearIcon />
              </Link>
            ) : (
              <Link href="/owner-login" className={styles.themeToggle} aria-label="Owner sign-in">
                <LockIcon />
              </Link>
            )}
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <SidebarLeft
          feeds={feeds}
          activeFilter={activeFilter}
          onSelect={handleFilterChange}
          counts={sidebarCounts}
        />

        <main id="main-feed" className={styles.feed}>
          {visibleItems.length === 0 && (
            <p className={styles.emptyState}>No items for this filter yet.</p>
          )}
          {visibleItems.map((item) => (
            <Card key={item.id} item={item} />
          ))}
          {hasMore && <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />}
        </main>

        <SidebarRight trendingRepos={trendingRepos} topHn={topHn} />
      </div>
    </>
  );
}
