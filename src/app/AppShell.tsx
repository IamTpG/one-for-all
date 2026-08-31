"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LockIcon } from "@/lib/icons";
import type { ActiveFilter, FeedItem, SettingsGroup } from "@/lib/types";
import Card from "./Card";
import FeedSettings from "./FeedSettings";
import SidebarLeft from "./SidebarLeft";
import SidebarRight from "./SidebarRight";
import ThemeToggle from "./ThemeToggle";
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
  settingsGroups,
  disabledFeeds,
  watchedRepos,
  isOwner,
  trendingRepos,
  topHn,
  fetchedAt,
}: {
  items: FeedItem[];
  feeds: { name: string; sourceId: string }[];
  settingsGroups: SettingsGroup[];
  disabledFeeds: string[];
  watchedRepos: string[];
  isOwner: boolean;
  trendingRepos: FeedItem[];
  topHn: FeedItem[];
  fetchedAt: number;
}) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ kind: "type", value: "all" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Starts equal to fetchedAt so the first client render matches the server
  // render exactly (both show "just now"); ticks forward after mount.
  const [now, setNow] = useState(fetchedAt);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filteredItems = useMemo(() => {
    if (activeFilter.kind === "source") {
      return items.filter((item) => item.sourceId === activeFilter.value);
    }
    if (activeFilter.kind === "topic") {
      return items.filter((item) => item.topics?.includes(activeFilter.value));
    }
    if (activeFilter.value === "all") return items;
    return items.filter((item) => item.sourceType === activeFilter.value);
  }, [items, activeFilter]);

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
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brand}>
            <span className={styles.brandIconChip}>
              <svg className={styles.brandMark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 17 L4 9" />
                <path d="M9 17 L9 5" />
                <path d="M14 17 L14 12" />
                <path d="M19 17 L19 7" />
              </svg>
            </span>
            <div className={styles.brandText}>
              <h1 className={`${styles.brandTitle} display`}>Wire</h1>
              <span className={`${styles.brandTagline} mono`}>AI · DEV · GITHUB</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            <span className={`${styles.feedMeta} mono`}>
              <span className={styles.liveDot} aria-hidden="true" />
              {items.length} items · updated {timeAgo(now, fetchedAt)}
            </span>
            {isOwner ? (
              <FeedSettings
                groups={settingsGroups}
                disabledFeeds={disabledFeeds}
                watchedRepos={watchedRepos}
              />
            ) : (
              <Link href="/owner-login" className={styles.themeToggle} aria-label="Owner sign-in">
                <LockIcon />
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <SidebarLeft feeds={feeds} activeFilter={activeFilter} onSelect={handleFilterChange} />

        <main className={styles.feed}>
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
