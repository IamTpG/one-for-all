import { isOnTopic, OFF_TOPIC } from "@/lib/keywordTopics";
import type { FeedItem, SourceType } from "@/lib/types";
import type { GroupId, HomeCopy } from "./homeCopy";

// Pure helpers for the home feed: grouping, selection and time phrases.
// Client-safe (no server imports).

export type FeedView = "new" | "all" | "saved";

export type FeedFilters = {
  view: FeedView | null; // null = automatic (New when there is something new)
  topic: string; // "all" | topic id | OFF_TOPIC
  source: string; // "all" | "type:<SourceType>" | "src:<sourceId>"
};

export const DEFAULT_FILTERS: FeedFilters = { view: null, topic: "all", source: "all" };

// Topics shown as tabs, in reading-priority order. Items that are only
// ai-industry have their own compact panel instead of a stream row.
export const TAB_TOPICS = ["ai-workflow", "ai-tools", "ai-updates", "career"] as const;
export const INDUSTRY_TOPIC = "ai-industry";
const SOURCE_TYPES: SourceType[] = ["rss", "hn", "github-trending", "github-release"];

// Industry news that is about nothing else: routed to the industry panel.
// An item that also carries a main topic stays in the stream.
export function isPureIndustry(item: Pick<FeedItem, "topics">): boolean {
  const topics = item.topics ?? [];
  return topics.includes(INDUSTRY_TOPIC) && !topics.some((topic) => (TAB_TOPICS as readonly string[]).includes(topic));
}

export function isNewItem(item: FeedItem, baseline: number | null): boolean {
  if (baseline === null) return false;
  const seenAt = item.firstSeenAt ?? new Date(item.publishedAt).getTime();
  return seenAt > baseline;
}

// The one topic a row is labelled with: the highest-read topic first
// (triage: workflow and career have the highest read rates).
export function primaryTopic(item: FeedItem): string | null {
  if (item.sourceType === "github-release") return "github-release";
  for (const topic of ["ai-workflow", "career", "ai-tools", "ai-updates", INDUSTRY_TOPIC]) {
    if (item.topics?.includes(topic)) return topic;
  }
  return isOnTopic(item) ? null : OFF_TOPIC;
}

export const GROUP_ORDER: GroupId[] = ["workflow", "career", "tools", "releases", "industry"];

// The band's chips count exactly what clicking them shows: the same rule
// as the topic tabs (an item can sit in several topics), releases by repo
// as the stream groups them, industry by its own panel.
export const GROUP_TOPIC: Partial<Record<GroupId, string>> = {
  workflow: "ai-workflow",
  career: "career",
  tools: "ai-tools",
};

// Counts rows as the stream shows them: each repo's releases are one row.
export function countEntries(items: FeedItem[]): number {
  let count = 0;
  const repos = new Set<string>();
  for (const item of items) {
    const repo = releaseRepo(item);
    if (repo) repos.add(repo);
    else count += 1;
  }
  return count + repos.size;
}

export function countGroups(items: FeedItem[]): Record<GroupId, number> {
  const onTopic = items.filter(isOnTopic);
  return {
    workflow: countEntries(onTopic.filter((item) => matchesTopic(item, "ai-workflow"))),
    career: countEntries(onTopic.filter((item) => matchesTopic(item, "career"))),
    tools: countEntries(onTopic.filter((item) => matchesTopic(item, "ai-tools"))),
    releases: countEntries(onTopic.filter((item) => item.sourceType === "github-release")),
    industry: onTopic.filter(isPureIndustry).length,
  };
}

export function matchesSource(item: FeedItem, source: string): boolean {
  if (source === "all") return true;
  if (source.startsWith("type:")) return item.sourceType === source.slice(5);
  if (source.startsWith("src:")) return item.sourceId === source.slice(4);
  return true;
}

export function matchesTopic(item: FeedItem, topic: string): boolean {
  if (topic === OFF_TOPIC) return !isOnTopic(item);
  if (!isOnTopic(item) || isPureIndustry(item)) return false;
  if (topic === "all") return true;
  // Every release is tagged ai-tools by its source; releases belong under
  // tool updates (and their own group), not in the tools & agents tab.
  if (topic === "ai-tools" && item.sourceType === "github-release") return false;
  return item.topics?.includes(topic) ?? false;
}

export function isValidFilters(value: unknown): value is FeedFilters {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const viewOk = v.view === null || v.view === "new" || v.view === "all" || v.view === "saved";
  const topicOk =
    typeof v.topic === "string" &&
    (v.topic === "all" || v.topic === OFF_TOPIC || (TAB_TOPICS as readonly string[]).includes(v.topic));
  const sourceOk =
    typeof v.source === "string" &&
    (v.source === "all" ||
      (v.source.startsWith("type:") && SOURCE_TYPES.includes(v.source.slice(5) as SourceType)) ||
      v.source.startsWith("src:"));
  return viewOk && topicOk && sourceOk;
}

// ---------- Releases grouped by repo ----------

export type ReleaseGroup = { kind: "releases"; key: string; repo: string; items: FeedItem[] };
export type SingleEntry = { kind: "item"; key: string; item: FeedItem };
export type FeedEntry = SingleEntry | ReleaseGroup;

export function releaseRepo(item: FeedItem): string | null {
  if (item.sourceType !== "github-release") return null;
  const fromId = item.id.startsWith("gh-release:") ? item.id.split(":")[1] : null;
  return fromId ?? item.title.split(":")[0] ?? null;
}

// "anthropics/claude-code" -> "Claude Code"; names that already carry
// their own casing ("OpenHands") are kept as written.
export function repoDisplayName(repo: string): string {
  const name = repo.split("/").pop() ?? repo;
  if (/[A-Z]/.test(name)) return name;
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function releaseVersion(item: FeedItem): string {
  if (item.tag) return item.tag;
  const afterColon = item.title.split(": ").slice(1).join(": ");
  return afterColon || item.title;
}

// Collapses each repo's releases into one entry, placed where that repo's
// newest release would sit. Input is newest-first, so the first release
// seen for a repo is its newest and marks the group's position.
export function groupEntries(items: FeedItem[]): FeedEntry[] {
  const entries: FeedEntry[] = [];
  const groups = new Map<string, ReleaseGroup>();
  for (const item of items) {
    const repo = releaseRepo(item);
    if (!repo) {
      entries.push({ kind: "item", key: item.id, item });
      continue;
    }
    const existing = groups.get(repo);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    const group: ReleaseGroup = { kind: "releases", key: `releases:${repo}`, repo, items: [item] };
    groups.set(repo, group);
    entries.push(group);
  }
  return entries.map((entry) =>
    entry.kind === "releases" && entry.items.length === 1
      ? { kind: "item", key: entry.items[0].id, item: entry.items[0] }
      : entry
  );
}

// The lead story is chosen by topic, never by picture: the first item of
// the topic in view (workflow by default, the highest read rate in triage),
// lifted to the top wherever it sits in the list. Its image is shown only when it holds up at
// lead size; otherwise the lead is set in type alone.
export function pickLead(items: FeedItem[], topic: string): FeedItem | null {
  const leadTopic = (TAB_TOPICS as readonly string[]).includes(topic) ? topic : "ai-workflow";
  return items.find((item) => item.topics?.includes(leadTopic)) ?? null;
}

// ---------- Time phrases ----------

const DAY_MS = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function clock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function shortDate(ts: number, copy: HomeCopy): string {
  return copy.shortDate(new Date(ts));
}

export function timeAgo(now: number, ts: number, copy: HomeCopy): string {
  const minutes = Math.floor((now - ts) / 60000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return copy.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.hoursAgo(hours);
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
  if (days <= 1) return copy.yesterday;
  if (days < 7) return copy.daysAgo(days);
  return shortDate(ts, copy);
}

export function sincePhrase(now: number, baseline: number, copy: HomeCopy): string {
  const days = Math.round((startOfDay(now) - startOfDay(baseline)) / DAY_MS);
  if (days <= 0) return copy.sinceToday(clock(baseline));
  if (days === 1) return copy.sinceYesterday(clock(baseline));
  if (days < 7) return copy.sinceWeekday(copy.weekdays[new Date(baseline).getDay()]);
  return copy.sinceDate(shortDate(baseline, copy));
}
