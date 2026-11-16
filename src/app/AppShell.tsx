"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChartIcon, ChevronIcon, GearIcon } from "@/lib/icons";
import { isOnTopic, OFF_TOPIC } from "@/lib/keywordTopics";
import type { FeedItem, SourceType } from "@/lib/types";
import {
  countEntries,
  countGroups,
  DEFAULT_FILTERS,
  GROUP_ORDER,
  GROUP_TOPIC,
  groupEntries,
  isNewItem,
  isPureIndustry,
  isValidFilters,
  matchesSource,
  matchesTopic,
  pickLead,
  sincePhrase,
  TAB_TOPICS,
  timeAgo,
  type FeedFilters,
  type FeedView,
} from "./feedModel";
import { trackVisitActivity, useSaved, useSeen, useVisit } from "./feedState";
import { IndustryPanel, ItemRow, LeadStory, ReleaseGroupRow, type RowContext } from "./FeedItemRow";
import { homeCopy, type GroupId } from "./homeCopy";
import { useLanguage } from "./LanguageProvider";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";
import ViewTracker from "./ViewTracker";
import styles from "./Feed.module.css";
import world from "./world.module.css";

const PAGE_SIZE = 15;
const SOURCE_TYPES: SourceType[] = ["rss", "hn", "github-trending", "github-release"];

// The App Router unmounts Home when navigating to an article (this project
// doesn't have `cacheComponents` enabled, which is the flag that would keep
// it mounted via React's Activity instead) — so a plain back-navigation
// remounts AppShell from scratch and loses how far you'd scrolled. This key
// persists just enough state across that remount/reload cycle to restore it.
const HOME_STATE_KEY = "oneforall-home-scroll";

type SavedHomeState = {
  visibleCount: number;
  filters: FeedFilters;
  scrollY: number;
};

// Read via useSyncExternalStore (below) instead of an effect + setState:
// that path applies the restored state as part of the first client render
// pass, before anything paints, so there's no visible flash of the default
// feed before it jumps to the restored one. getSnapshot must return a
// referentially stable value when nothing changed, hence the raw-string
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
    const parsed = raw ? (JSON.parse(raw) as Partial<SavedHomeState>) : null;
    cachedHomeState =
      parsed && isValidFilters(parsed.filters) && typeof parsed.visibleCount === "number"
        ? { visibleCount: parsed.visibleCount, filters: parsed.filters, scrollY: Number(parsed.scrollY) || 0 }
        : null;
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

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function AppShell({
  items,
  feeds,
  isOwner,
  fetchedAt,
  retentionDays,
}: {
  items: FeedItem[];
  feeds: { name: string; sourceId: string }[];
  isOwner: boolean;
  fetchedAt: number | null;
  retentionDays: number;
}) {
  const { language } = useLanguage();
  const copy = homeCopy(language);
  const visit = useVisit();
  const seen = useSeen();
  const saved = useSaved();
  const baseline = visit?.baseline ?? null;

  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(() => new Set());

  // Restore a saved feed position (e.g. after coming back from an article).
  // Applied during render rather than in an effect: getServerSnapshot
  // returns null so the server/hydration render always matches (no
  // mismatch), and the moment the client snapshot resolves, this update
  // happens synchronously before the first client paint.
  const savedHomeState = useSyncExternalStore(subscribeHomeState, getHomeStateSnapshot, getHomeStateServerSnapshot);
  const [appliedHomeState, setAppliedHomeState] = useState<SavedHomeState | null>(null);
  const [pendingScrollY, setPendingScrollY] = useState<number | null>(null);
  if (savedHomeState && savedHomeState !== appliedHomeState) {
    setAppliedHomeState(savedHomeState);
    setFilters(savedHomeState.filters);
    setVisibleCount(savedHomeState.visibleCount);
    setPendingScrollY(savedHomeState.scrollY);
  }

  // Starts from a value the server and client agree on (the last fetch),
  // then ticks forward after mount.
  const [now, setNow] = useState(() => fetchedAt ?? (items[0] ? Date.parse(items[0].publishedAt) : 0));
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const feedTopRef = useRef<HTMLDivElement | null>(null);

  // The order you're currently scrolling through, frozen independently of
  // the `items` prop. A router.refresh() re-renders this component with a
  // freshly re-sorted `items` array, which would otherwise splice new items
  // into wherever their publish date lands — including above stuff you've
  // already scrolled past. Anything still present gets its data refreshed
  // in place, anything gone disappears, and anything new is appended.
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

  const liveIds = useMemo(() => new Set(stableItems.map((item) => item.id)), [stableItems]);
  const savedIds = useMemo(() => new Set(saved.map((item) => item.id)), [saved]);

  // ---------- Catch-up summary ----------

  const onTopicItems = useMemo(() => stableItems.filter(isOnTopic), [stableItems]);
  const newItems = useMemo(
    () => (baseline === null ? [] : onTopicItems.filter((item) => isNewItem(item, baseline))),
    [onTopicItems, baseline]
  );
  const groupCounts = useMemo(
    () => countGroups(baseline === null ? onTopicItems : newItems),
    [baseline, onTopicItems, newItems]
  );
  // Counted as rows, the way the stream shows them (a repo's releases are one).
  const newCount = useMemo(() => countEntries(newItems), [newItems]);
  const onTopicCount = useMemo(() => countEntries(onTopicItems), [onTopicItems]);
  const oldestSeenAt = useMemo(() => {
    let oldest = Infinity;
    for (const item of stableItems) {
      const ts = item.firstSeenAt ?? Date.parse(item.publishedAt);
      if (ts < oldest) oldest = ts;
    }
    return oldest;
  }, [stableItems]);

  const view: FeedView = filters.view ?? (newItems.length > 0 ? "new" : "all");

  // ---------- The list ----------

  const scoped = useMemo<FeedItem[]>(() => {
    if (view === "saved") {
      const liveById = new Map(stableItems.map((item) => [item.id, item]));
      return saved.map((snapshot) => liveById.get(snapshot.id) ?? (snapshot as FeedItem));
    }
    return stableItems.filter(
      (item) =>
        matchesTopic(item, filters.topic) &&
        matchesSource(item, filters.source) &&
        (view !== "new" || isNewItem(item, baseline))
    );
  }, [view, stableItems, saved, filters.topic, filters.source, baseline]);

  const lead = view !== "saved" && filters.topic !== OFF_TOPIC ? pickLead(scoped, filters.topic) : null;
  const entries = useMemo(
    () => groupEntries(lead ? scoped.filter((item) => item.id !== lead.id) : scoped),
    [scoped, lead]
  );
  const visibleEntries = entries.slice(0, visibleCount);
  const hasMore = visibleCount < entries.length;

  // The industry panel follows the view (only new ones in New) and the
  // source filter, and has no place on the Off-topic tab or in Saved.
  const showIndustry = view !== "saved" && filters.topic !== OFF_TOPIC;
  const industryItems = useMemo(
    () =>
      showIndustry
        ? stableItems.filter(
            (item) =>
              isOnTopic(item) &&
              isPureIndustry(item) &&
              matchesSource(item, filters.source) &&
              (view !== "new" || isNewItem(item, baseline))
          )
        : [],
    [showIndustry, stableItems, filters.source, view, baseline]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const topic of ["all", ...TAB_TOPICS, OFF_TOPIC]) {
      counts[topic] = countEntries(
        stableItems.filter(
          (item) =>
            matchesTopic(item, topic) &&
            matchesSource(item, filters.source) &&
            (view !== "new" || isNewItem(item, baseline))
        )
      );
    }
    return counts;
  }, [stableItems, filters.source, view, baseline]);

  function updateFilters(next: Partial<FeedFilters>) {
    setFilters((prev) => ({ ...prev, ...next }));
    setVisibleCount(PAGE_SIZE);
  }

  function scrollToFeed() {
    const node = feedTopRef.current;
    if (!node) return;
    if (node.getBoundingClientRect().top < 0 || node.getBoundingClientRect().top > window.innerHeight * 0.6) {
      node.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }
  }

  function selectGroup(group: GroupId) {
    if (group === "industry") {
      const panel = Array.from(document.querySelectorAll<HTMLElement>("[data-industry-panel]")).find(
        (node) => node.offsetParent !== null
      );
      panel?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      panel?.focus({ preventScroll: true });
      return;
    }
    const viewForGroup: FeedView = baseline === null ? "all" : "new";
    if (group === "releases") updateFilters({ view: viewForGroup, topic: "all", source: "type:github-release" });
    else updateFilters({ view: viewForGroup, topic: GROUP_TOPIC[group] ?? "all", source: "all" });
    scrollToFeed();
  }

  const markImageBroken = (id: string) =>
    setBrokenImages((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const ctx: RowContext = {
    copy,
    language,
    now,
    baseline,
    seen,
    savedIds,
    liveIds,
    showNewBadge: view !== "new",
    onImageError: markImageBroken,
  };

  // ---------- Effects ----------

  // Runs after the restored item count has committed to the DOM but before
  // the browser paints, so the scroll jump is never visible either.
  useLayoutEffect(() => {
    if (pendingScrollY === null) return;
    window.scrollTo(0, pendingScrollY);
    const timeout = setTimeout(() => setPendingScrollY(null), 0);
    return () => clearTimeout(timeout);
  }, [pendingScrollY, visibleEntries.length]);

  // Persist the position for the next mount (coming back from an article,
  // or a reload). Written only on unmount / pagehide, never on every state
  // change: the write feeds getHomeStateSnapshot above, so saving while
  // mounted would "restore" stale state in a loop.
  const latestHomeStateRef = useRef({ visibleCount, filters });
  useEffect(() => {
    latestHomeStateRef.current = { visibleCount, filters };
  });

  useEffect(() => {
    function save() {
      try {
        sessionStorage.setItem(
          HOME_STATE_KEY,
          JSON.stringify({ ...latestHomeStateRef.current, scrollY: window.scrollY } satisfies SavedHomeState)
        );
      } catch {
        // Private browsing / storage full — nothing to fall back to.
      }
    }
    // Leaving the tab records when the reader was last here; coming back
    // after a long gap starts a new visit (touchActivity decides).
    const stopTracking = trackVisitActivity(save);
    return () => {
      stopTracking();
      save();
    };
  }, []);

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
      (observed) => {
        if (observed[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, entries.length));
        }
      },
      { rootMargin: "800px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, entries.length]);

  // ---------- Band copy ----------

  const neverFetched = fetchedAt === null && stableItems.length === 0;
  let sentence: string;
  let leadLine: string | null = null;
  let note: string | null = null;
  if (neverFetched) {
    sentence = copy.neverFetched;
    note = copy.neverFetchedNote;
  } else if (visit === null || baseline === null) {
    sentence = copy.firstVisit(onTopicCount);
    note = visit === null ? null : copy.firstVisitNote;
  } else if (newCount === 0) {
    sentence = copy.nothingNew(sincePhrase(now, baseline, copy));
  } else {
    sentence = copy.newSince(newCount, sincePhrase(now, baseline, copy));
    const leadGroup = (["workflow", "career", "releases", "tools"] as GroupId[]).find(
      (group) => groupCounts[group] > 0 && copy.newLead[group]
    );
    if (leadGroup) leadLine = copy.newLead[leadGroup]!(groupCounts[leadGroup]);
    if (baseline < oldestSeenAt) note = copy.longGapNote(retentionDays);
  }
  // Any sentence that opens with a number gets the band's numeral setting.
  const leadingNumber = sentence.match(/^\d+/)?.[0];
  const headline: React.ReactNode = leadingNumber ? (
    <>
      <span className={styles.bandCount}>{leadingNumber}</span>
      {sentence.slice(leadingNumber.length)}
    </>
  ) : (
    sentence
  );

  const sourceTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const type of SOURCE_TYPES) {
      counts[type] = countEntries(onTopicItems.filter((item) => item.sourceType === type));
    }
    return counts;
  }, [onTopicItems]);

  const showTabs = view !== "saved";
  // No industry items: no reserved column, the stream owns the page.
  const hasAside = industryItems.length > 0;
  const filtersActive = filters.topic !== "all" || filters.source !== "all";
  const industryInlineAt = Math.min(4, visibleEntries.length);

  function renderEntry(index: number) {
    const entry = visibleEntries[index];
    return entry.kind === "releases" ? (
      <ReleaseGroupRow key={entry.key} group={entry} ctx={ctx} />
    ) : (
      <ItemRow key={entry.key} item={entry.item} ctx={ctx} />
    );
  }

  const industryInline =
    hasAside ? (
      <IndustryPanel
        key="industry-inline"
        items={industryItems}
        ctx={ctx}
        id="tin-nganh-inline"
        className={styles.industryInline}
      />
    ) : null;

  return (
    <div className={world.world}>
      <a href="#main-feed" className={world.skipLink}>
        {copy.skip}
      </a>
      <ViewTracker type="home" />

      <header className={styles.top}>
        <div className={clsx(world.container, world.topInner)}>
          {/* Plain <a>, not next/link's <Link> — a real anchor always
              triggers a full reload, refetching everything fresh. The saved
              scroll key is cleared too, otherwise this "fresh reload" would
              immediately restore the old position it's meant to discard. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className={world.brand}
            onClick={() => {
              try {
                sessionStorage.removeItem(HOME_STATE_KEY);
              } catch {
                // Private browsing / storage disabled — nothing to clear.
              }
            }}
          >
            OneForAll
          </a>
          <nav className={styles.views} aria-label={copy.viewsLabel}>
            {(["new", "all", "saved"] as FeedView[]).map((option) => {
              const count = option === "new" ? newCount : option === "saved" ? saved.length : 0;
              return (
                <button
                  key={option}
                  type="button"
                  className={styles.viewButton}
                  aria-pressed={view === option}
                  onClick={() => updateFilters({ view: option })}
                >
                  {copy.views[option]}
                  {count > 0 && <span className={styles.viewCount}>{count}</span>}
                </button>
              );
            })}
          </nav>
          <div className={world.topActions}>
            {isOwner && (
              <>
                <Link href="/dashboard" className={world.circleButton} aria-label={copy.dashboard} title={copy.dashboard}>
                  <ChartIcon />
                </Link>
                <Link href="/settings" className={world.circleButton} aria-label={copy.settings} title={copy.settings}>
                  <GearIcon />
                </Link>
              </>
            )}
            <LanguageToggle className={world.pillButton} />
            <ThemeToggle
              className={world.inkButton}
              labels={{ toDark: copy.themeToDark, toLight: copy.themeToLight }}
            />
          </div>
        </div>
      </header>

      <section className={styles.band} aria-label={copy.catchUpLabel}>
        <div className={world.container}>
          <h1 className={styles.bandHeadline}>
            {headline}
            {leadLine && <span className={styles.bandLead}> {leadLine}</span>}
          </h1>
          {!neverFetched && GROUP_ORDER.some((group) => groupCounts[group] > 0) && (
            <ul className={styles.groups}>
              {GROUP_ORDER.filter((group) => groupCounts[group] > 0).map((group) => (
                <li key={group}>
                  <button type="button" className={styles.groupChip} onClick={() => selectGroup(group)}>
                    <span className={styles.groupCount}>{groupCounts[group]}</span>
                    {copy.groups[group](groupCounts[group])}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.bandNote}>
            {note && <span>{note}</span>}
            {fetchedAt !== null && (
              <span className={styles.bandUpdated}>{copy.updatedAgo(timeAgo(now, fetchedAt, copy))}</span>
            )}
          </p>
        </div>
      </section>

      <div ref={feedTopRef} className={styles.filterBar}>
        <div className={clsx(world.container, styles.filterInner)}>
          {showTabs ? (
            <nav className={styles.tabs} aria-label={copy.topicsLabel}>
              {(["all", ...TAB_TOPICS, OFF_TOPIC] as string[]).map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={styles.tab}
                  aria-pressed={filters.topic === topic}
                  onClick={() => updateFilters({ topic })}
                >
                  {topic === "all" ? copy.topicAll : copy.topics[topic]}
                  <span className={styles.tabCount}>{tabCounts[topic] ?? 0}</span>
                </button>
              ))}
            </nav>
          ) : (
            <p className={styles.savedNote}>{copy.savedNote}</p>
          )}
          {showTabs && (
            <label className={styles.sourceSelect}>
              <span className={world.visuallyHidden}>{copy.sourceLabel}</span>
              <select
                value={filters.source}
                onChange={(event) => updateFilters({ source: event.target.value })}
                aria-label={copy.sourceLabel}
              >
                <option value="all">{copy.sourceAll}</option>
                <optgroup label={copy.sourceTypes}>
                  {SOURCE_TYPES.map((type) => (
                    <option key={type} value={`type:${type}`}>
                      {copy.typeNames[type]} (
                      {type === "github-release"
                        ? copy.repoCount(sourceTypeCounts[type] ?? 0)
                        : (sourceTypeCounts[type] ?? 0)}
                      )
                    </option>
                  ))}
                </optgroup>
                {feeds.length > 0 && (
                  <optgroup label={copy.sourceFeeds}>
                    {feeds.map((feed) => (
                      <option key={feed.sourceId} value={`src:${feed.sourceId}`}>
                        {feed.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronIcon className={styles.selectIcon} />
            </label>
          )}
        </div>
      </div>

      <div className={clsx(world.container, styles.layout, hasAside && styles.layoutWithSide)}>
        <main id="main-feed" className={styles.stream} tabIndex={-1}>
          {lead && <LeadStory item={lead} ctx={ctx} withImage={Boolean(lead.imageUrl) && !brokenImages.has(lead.id)} />}
          {visibleEntries.length === 0 && !lead && (
            <div className={styles.empty}>
              {view === "saved" ? (
                <>
                  <p className={styles.emptyTitle}>{copy.emptySaved}</p>
                  <p className={styles.emptyNote}>{copy.emptySavedNote}</p>
                </>
              ) : stableItems.length === 0 ? (
                <p className={styles.emptyTitle}>{copy.emptyStore}</p>
              ) : filtersActive ? (
                <>
                  <p className={styles.emptyTitle}>{copy.emptyFilter}</p>
                  <button type="button" className={styles.emptyAction} onClick={() => updateFilters({ topic: "all", source: "all" })}>
                    {copy.emptyFilterAction}
                  </button>
                </>
              ) : view === "new" ? (
                <>
                  <p className={styles.emptyTitle}>{copy.emptyNew}</p>
                  <button type="button" className={styles.emptyAction} onClick={() => updateFilters({ view: "all" })}>
                    {copy.emptyNewAction}
                  </button>
                </>
              ) : (
                <p className={styles.emptyTitle}>{copy.emptyStore}</p>
              )}
            </div>
          )}
          {visibleEntries.slice(0, industryInlineAt).map((_, index) => renderEntry(index))}
          {industryInline}
          {visibleEntries.slice(industryInlineAt).map((_, index) => renderEntry(index + industryInlineAt))}
          {hasMore && (
            <div ref={sentinelRef} className={styles.sentinel} role="status">
              <span className={world.visuallyHidden}>{copy.loadingMore}</span>
            </div>
          )}
        </main>

        {hasAside && (
          <aside className={styles.side}>
            <IndustryPanel items={industryItems} ctx={ctx} id="tin-nganh" className={styles.industryAside} />
          </aside>
        )}
      </div>
    </div>
  );
}
