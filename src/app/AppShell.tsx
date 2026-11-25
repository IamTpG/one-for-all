"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChartIcon, CloseIcon, GearIcon } from "@/lib/icons";
import { isOnTopic, OFF_TOPIC } from "@/lib/keywordTopics";
import { filterOptions, itemFilterKey } from "@/lib/sourceRegistry";
import type { FeedItem } from "@/lib/types";
import {
  countEntries,
  countGroups,
  DEFAULT_FILTERS,
  GROUP_ORDER,
  GROUP_TOPIC,
  groupEntries,
  isNewItem,
  isPureIndustry,
  matchesSources,
  matchesTopic,
  normaliseSources,
  parseFilters,
  pickLead,
  sincePhrase,
  TAB_TOPICS,
  timeAgo,
  type FeedFilters,
  type FeedView,
} from "./feedModel";
import {
  replaceUrlSources,
  saveStoredSources,
  trackVisitActivity,
  useSaved,
  useSeen,
  useStoredSources,
  useUrlSourcesParam,
  useVisit,
} from "./feedState";
import { IndustryPanel, ItemRow, LaunchGroupRow, LeadStory, ReleaseGroupRow, type RowContext } from "./FeedItemRow";
import { homeCopy, type GroupId } from "./homeCopy";
import { useLanguage } from "./LanguageProvider";
import LanguageToggle from "./LanguageToggle";
import SourceFilter, { type SourceCounts } from "./SourceFilter";
import { removeIds, resolveSources, selectionChips } from "./sourceFilterModel";
import ThemeToggle from "./ThemeToggle";
import ViewTracker from "./ViewTracker";
import styles from "./Feed.module.css";
import world from "./world.module.css";

const PAGE_SIZE = 15;
// Saved states are read before the page knows which sources are disabled, so
// they are validated against the whole registry here and again against the
// options on offer once the component has them.
const REGISTRY_OPTIONS = filterOptions();

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
    const filters = parsed ? parseFilters(parsed.filters, REGISTRY_OPTIONS) : null;
    cachedHomeState =
      parsed && filters && typeof parsed.visibleCount === "number"
        ? { visibleCount: parsed.visibleCount, filters, scrollY: Number(parsed.scrollY) || 0 }
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
  disabledFeeds,
  isOwner,
  fetchedAt,
  retentionDays,
  officialFailures = 0,
}: {
  items: FeedItem[];
  // sourceIds switched off in Settings; their options leave the source filter.
  disabledFeeds: string[];
  isOwner: boolean;
  fetchedAt: number | null;
  retentionDays: number;
  // Official sources that failed on the last fetch (0 until the dashboard's
  // source health feeds it).
  officialFailures?: number;
}) {
  const { language } = useLanguage();
  const copy = homeCopy(language);
  const visit = useVisit();
  const seen = useSeen();
  const saved = useSaved();
  const baseline = visit?.baseline ?? null;

  const options = useMemo(() => filterOptions(new Set(disabledFeeds)), [disabledFeeds]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // View and topic are plain state. The source filter has three origins, in
  // this order: what the reader did on this page (sourcesOverride), the
  // ?sources= URL parameter, then the value saved on this device. Only the
  // reader's own change is written back to storage.
  const [nav, setNav] = useState<Pick<FeedFilters, "view" | "topic">>({
    view: DEFAULT_FILTERS.view,
    topic: DEFAULT_FILTERS.topic,
  });
  const [sourcesOverride, setSourcesOverride] = useState<string[] | null>(null);
  const storedSources = useStoredSources();
  const urlSourcesParam = useUrlSourcesParam();
  const resolvedSources = useMemo(
    () => resolveSources(urlSourcesParam, storedSources, options).sources,
    [urlSourcesParam, storedSources, options]
  );
  const sources = sourcesOverride ?? resolvedSources;
  const filters = useMemo<FeedFilters>(() => ({ ...nav, sources }), [nav, sources]);
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
    setNav({ view: savedHomeState.filters.view, topic: savedHomeState.filters.topic });
    // A filter in the URL wins over the one this page last had.
    if (urlSourcesParam === null) setSourcesOverride(normaliseSources(savedHomeState.filters.sources, options));
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
        matchesSources(item, sources) &&
        (view !== "new" || isNewItem(item, baseline))
    );
  }, [view, stableItems, saved, filters.topic, sources, baseline]);

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
              matchesSources(item, sources) &&
              (view !== "new" || isNewItem(item, baseline))
          )
        : [],
    [showIndustry, stableItems, sources, view, baseline]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const topic of ["all", ...TAB_TOPICS, OFF_TOPIC]) {
      counts[topic] = countEntries(
        stableItems.filter(
          (item) =>
            matchesTopic(item, topic) &&
            matchesSources(item, sources) &&
            (view !== "new" || isNewItem(item, baseline))
        )
      );
    }
    return counts;
  }, [stableItems, sources, view, baseline]);

  // What each dropdown option would show under the topic and view in force
  // (the source selection itself is not applied: the counts say what picking
  // an option adds).
  const sourceCounts = useMemo<SourceCounts>(() => {
    const byKey = new Map<string, FeedItem[]>();
    for (const item of stableItems) {
      if (!matchesTopic(item, filters.topic)) continue;
      if (view === "new" && !isNewItem(item, baseline)) continue;
      const key = itemFilterKey(item);
      if (!key) continue;
      const list = byKey.get(key);
      if (list) list.push(item);
      else byKey.set(key, [item]);
    }
    const byId: Record<string, number> = {};
    for (const [key, list] of byKey) byId[key] = countEntries(list);
    const groupCount = (group: { id: string }[]) => countEntries(group.flatMap((option) => byKey.get(option.id) ?? []));
    return {
      byId,
      official: groupCount(options.official),
      community: groupCount(options.community),
      result: tabCounts[filters.topic] ?? 0,
    };
  }, [stableItems, filters.topic, view, baseline, options, tabCounts]);

  // View and topic changes (the source filter has its own: changeSources).
  function updateFilters(next: Partial<Pick<FeedFilters, "view" | "topic">>) {
    setNav((prev) => ({ ...prev, ...next }));
    setVisibleCount(PAGE_SIZE);
  }

  // `persist` is true only for the reader's own use of the filter controls.
  // Jumping from a band chip narrows the list for this visit and the URL, but
  // does not replace the filter saved on this device.
  function changeSources(next: string[], persist: boolean) {
    const clean = normaliseSources(next, options);
    setSourcesOverride(clean);
    setVisibleCount(PAGE_SIZE);
    replaceUrlSources(clean);
    if (persist) saveStoredSources(clean);
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
    if (group === "releases") {
      // Releases answer to their publisher (official repos) or to
      // "GitHub releases" (the rest): select whichever the band counted.
      const releaseKeys = onTopicItems
        .filter((item) => item.sourceType === "github-release" && (viewForGroup === "all" || isNewItem(item, baseline)))
        .map(itemFilterKey)
        .filter((key): key is string => key !== null);
      updateFilters({ view: viewForGroup, topic: "all" });
      changeSources(releaseKeys, false);
    } else {
      updateFilters({ view: viewForGroup, topic: GROUP_TOPIC[group] ?? "all" });
      changeSources([], false);
    }
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

  // The position is tracked as it changes: by the time this component
  // unmounts during a client-side navigation, the router may already have
  // moved the page, so window.scrollY at that moment is not the reader's.
  const latestScrollYRef = useRef(0);
  useEffect(() => {
    latestScrollYRef.current = window.scrollY;
    function onScroll() {
      // The router's own scroll-to-top can fire while this page is still
      // mounted (its cleanup runs later); that position is not the reader's.
      if (window.location.pathname !== "/") return;
      latestScrollYRef.current = window.scrollY;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Coming back with nothing saved (a link from elsewhere, e.g. an article
  // opened directly): start at the top. Links back from an article keep the
  // router from scrolling (scroll={false}), so this is what resets them.
  useLayoutEffect(() => {
    if (!getHomeStateSnapshot()) window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    function save() {
      try {
        sessionStorage.setItem(
          HOME_STATE_KEY,
          JSON.stringify({ ...latestHomeStateRef.current, scrollY: latestScrollYRef.current } satisfies SavedHomeState)
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

  const showTabs = view !== "saved";
  // No industry items: no reserved column, the stream owns the page.
  const hasAside = industryItems.length > 0;
  const sourceChips = selectionChips(sources, options, {
    all: copy.sourceAll,
    allOfficial: copy.sourceAllOfficial,
    community: copy.sourceGroupCommunity,
  });
  const officialSelected = sources.some((id) => options.official.some((option) => option.id === id));
  const emptySourceName =
    sources.length === 1 ? ([...options.official, ...options.community].find((o) => o.id === sources[0])?.name ?? sources[0]) : null;
  const industryInlineAt = Math.min(4, visibleEntries.length);

  function renderEntry(index: number) {
    const entry = visibleEntries[index];
    if (entry.kind === "releases") return <ReleaseGroupRow key={entry.key} group={entry} ctx={ctx} />;
    if (entry.kind === "launch") return <LaunchGroupRow key={entry.key} group={entry} ctx={ctx} />;
    return <ItemRow key={entry.key} item={entry.item} ctx={ctx} />;
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
    <div ref={rootRef} className={world.world}>
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
            <SourceFilter
              options={options}
              selected={sources}
              counts={sourceCounts}
              copy={copy}
              onChange={(next) => changeSources(next, true)}
              portalRef={rootRef}
            />
          )}
        </div>
      </div>

      {showTabs && sourceChips.length > 0 && (
        <div className={world.container}>
          <div className={styles.activeFilter}>
            <span>{copy.sourceFiltering}</span>
            <ul className={styles.activeChips}>
              {sourceChips.map((chip) => (
                <li key={chip.key} className={styles.activeChip}>
                  {chip.label}
                  <button
                    type="button"
                    className={styles.activeRemove}
                    aria-label={copy.sourceRemove(chip.label)}
                    onClick={() => changeSources(removeIds(sources, chip.ids, options), true)}
                  >
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.activeClear} onClick={() => changeSources([], true)}>
              {copy.sourceClear}
            </button>
          </div>
        </div>
      )}

      <div className={clsx(world.container, styles.layout, hasAside && styles.layoutWithSide)}>
        <main id="main-feed" className={styles.stream} tabIndex={-1}>
          {officialFailures > 0 && officialSelected && (
            <p className={styles.officialNote} role="status">
              {copy.officialFailed(officialFailures)}
            </p>
          )}
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
              ) : sources.length > 0 ? (
                <>
                  <p className={styles.emptyTitle}>
                    {emptySourceName ? copy.emptySourceOne(emptySourceName) : copy.emptySourceNone}
                  </p>
                  <p className={styles.emptyNote}>{copy.emptySourceNote}</p>
                  <button type="button" className={styles.emptyAction} onClick={() => changeSources([], true)}>
                    {copy.emptySourceAction}
                  </button>
                </>
              ) : filters.topic !== "all" ? (
                <>
                  <p className={styles.emptyTitle}>{copy.emptyFilter}</p>
                  <button type="button" className={styles.emptyAction} onClick={() => updateFilters({ topic: "all" })}>
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
