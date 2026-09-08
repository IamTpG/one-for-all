"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
              fresh (new items, reset scroll/pagination state). */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={styles.brand}>
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
