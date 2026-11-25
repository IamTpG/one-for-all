// Relative imports with extensions: this file is tested under `node --test`,
// which does not resolve the "@/" alias.
import { isOnTopic, OFF_TOPIC } from "../lib/keywordTopics.ts";
import { canonicalUrl, isEntryUrl } from "../lib/official/canonical.ts";
import { modelIdKey } from "../lib/official/kind.ts";
import { isChangelogSource, itemFilterKey, type FilterOptions } from "../lib/sourceRegistry.ts";
import type { FeedItem } from "../lib/types.ts";
import type { GroupId, HomeCopy } from "./homeCopy.ts";
import { normaliseSources } from "./sourceFilterModel.ts";

export { normaliseSources };

// Pure helpers for the home feed: grouping, selection and time phrases.
// Client-safe (no server imports).

export type FeedView = "new" | "all" | "saved";

export type FeedFilters = {
  view: FeedView | null; // null = automatic (New when there is something new)
  topic: string; // "all" | topic id | OFF_TOPIC
  // Publisher ids (official) and community source ids; [] = every source.
  sources: string[];
};

export const DEFAULT_FILTERS: FeedFilters = { view: null, topic: "all", sources: [] };

// Topics shown as tabs, in reading-priority order. Items that are only
// ai-industry have their own compact panel instead of a stream row.
export const TAB_TOPICS = ["ai-workflow", "ai-tools", "ai-updates", "career"] as const;
export const INDUSTRY_TOPIC = "ai-industry";

// Industry news that is about nothing else: routed to the industry panel.
// An item that also carries a main topic stays in the stream.
export function isPureIndustry(item: Pick<FeedItem, "topics">): boolean {
  const topics = item.topics ?? [];
  return topics.includes(INDUSTRY_TOPIC) && !topics.some((topic) => (TAB_TOPICS as readonly string[]).includes(topic));
}

// An official item published long before the reader's last visit is not
// news just because the store first saw it later (the first deploy, a
// changelog entry back-dated by its vendor, xAI's month-only dates).
export const OFFICIAL_BACKDATE_WINDOW_MS = 7 * 86_400_000;

export function isNewItem(item: FeedItem, baseline: number | null): boolean {
  if (baseline === null) return false;
  const seenAt = item.firstSeenAt ?? new Date(item.publishedAt).getTime();
  if (seenAt <= baseline) return false;
  if (item.official) {
    const published = Date.parse(item.publishedAt);
    if (Number.isFinite(published) && published <= baseline - OFFICIAL_BACKDATE_WINDOW_MS) return false;
  }
  return true;
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

// Counts rows as the stream shows them: each repo's (or official
// product's) releases are one row, and so is each launch.
export function countEntries(items: FeedItem[]): number {
  return groupEntries(items).length;
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

// ---------- Source filter ----------

// An item passes when no source is selected, or when the source it answers
// to (its publisher for an official update, see itemFilterKey) is selected.
export function matchesSources(item: FeedItem, sources: readonly string[]): boolean {
  if (sources.length === 0) return true;
  const key = itemFilterKey(item);
  return key !== null && sources.includes(key);
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

// Reads a saved home state. States saved before the multi-select source
// filter carry a single `source` ("all" | "src:<id>" | "type:<type>"); they
// still load: "all" and the retired type filters mean no filter, `src:<id>`
// becomes [id] when the id is known.
export function parseFilters(value: unknown, options: FilterOptions): FeedFilters | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const viewOk = v.view === null || v.view === "new" || v.view === "all" || v.view === "saved";
  const topicOk =
    typeof v.topic === "string" &&
    (v.topic === "all" || v.topic === OFF_TOPIC || (TAB_TOPICS as readonly string[]).includes(v.topic));
  if (!viewOk || !topicOk) return null;

  let sources: string[];
  if (Array.isArray(v.sources)) {
    sources = normaliseSources(v.sources, options);
  } else if (typeof v.source === "string") {
    sources = v.source.startsWith("src:") ? normaliseSources([v.source.slice(4)], options) : [];
  } else {
    return null;
  }
  return { view: v.view as FeedView | null, topic: v.topic as string, sources };
}

export function isValidFilters(value: unknown, options: FilterOptions): boolean {
  return parseFilters(value, options) !== null;
}

// ---------- Releases grouped by repo or official product ----------

// `groupKey` is the repo ("owner/name") or, for an official tool release that
// does not come from GitHub (Codex CLI in the ChatGPT & Codex changelog), the
// publisher and product. `label` is what the row calls the group.
export type ReleaseGroup = { kind: "releases"; key: string; groupKey: string; label: string; items: FeedItem[] };
export type SingleEntry = { kind: "item"; key: string; item: FeedItem };
export type FeedEntry = SingleEntry | ReleaseGroup | LaunchGroup;

export function releaseRepo(item: FeedItem): string | null {
  if (item.sourceType !== "github-release") return null;
  const fromId = item.id.startsWith("gh-release:") ? item.id.split(":")[1] : null;
  return fromId ?? item.title.split(":")[0] ?? null;
}

// What a tool release is grouped under: its repo, or its official product.
export function releaseGroupKey(item: FeedItem): string | null {
  const repo = releaseRepo(item);
  if (repo) return repo;
  if (item.official?.kind === "tool-release" && item.official.product) {
    return `${item.official.publisher}:${item.official.product}`;
  }
  return null;
}

export function releaseGroupLabel(item: FeedItem): string {
  const repo = releaseRepo(item);
  if (repo) return repoDisplayName(repo);
  return item.official?.product ?? item.source;
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

// Official posts of one publisher about the same launch (a DeepMind post,
// the Gemini API changelog entry and a dev blog post) collapse into one row
// when they are at most this far apart.
export const LAUNCH_WINDOW_MS = 7 * 86_400_000;

// The row's lead is the changelog-class entry (the most precise one); the
// other official posts sit behind a disclosure. `items` has the lead first.
export type LaunchGroup = { kind: "launch"; key: string; groupKey: string; lead: FeedItem; items: FeedItem[] };

// Same launch: the model's launchKey, or, without Groq, the first model id in
// the title of a model release. Tool releases already group per product.
export function launchKey(item: FeedItem): string | null {
  const official = item.official;
  if (!official?.kind || official.kind === "tool-release") return null;
  const key = official.launchKey ?? (official.kind === "model-release" ? modelIdKey(item.title) : undefined);
  if (!key || isGenericLaunchKey(key, official)) return null;
  return `${official.publisher}:${key}`;
}

// A key naming a whole vendor or product ("anthropic", "codex") says nothing
// about one launch and would merge unrelated posts.
const GENERIC_LAUNCH_KEYS = new Set([
  "anthropic", "openai", "google", "xai", "claude", "chatgpt", "codex", "gemini", "grok", "gpt", "api", "models", "model",
]);

function keySlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function isGenericLaunchKey(key: string, official: { publisher: string; product?: string }): boolean {
  const slug = keySlug(key);
  return (
    slug === "" ||
    GENERIC_LAUNCH_KEYS.has(slug) ||
    slug === keySlug(official.publisher) ||
    (official.product !== undefined && slug === keySlug(official.product))
  );
}

function publishedMs(item: FeedItem): number {
  const ms = Date.parse(item.publishedAt);
  return Number.isFinite(ms) ? ms : 0;
}

function leadOf(items: FeedItem[]): FeedItem {
  return items.find((item) => isChangelogSource(item.sourceId)) ?? items[0];
}

// Collapses each repo's (or official product's) releases into one entry,
// and each official launch covered by several posts into one, placed where
// the newest member would sit. Input is newest-first, so the first item seen
// for a group is its newest and marks its position.
export function groupEntries(items: FeedItem[]): FeedEntry[] {
  const entries: FeedEntry[] = [];
  const groups = new Map<string, ReleaseGroup>();
  const launches = new Map<string, LaunchGroup>();
  for (const item of items) {
    const groupKey = releaseGroupKey(item);
    if (groupKey) {
      const existing = groups.get(groupKey);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      const group: ReleaseGroup = {
        kind: "releases",
        key: `releases:${groupKey}`,
        groupKey,
        label: releaseGroupLabel(item),
        items: [item],
      };
      groups.set(groupKey, group);
      entries.push(group);
      continue;
    }
    const launch = launchKey(item);
    if (launch) {
      // A key can recur after a gap: only the latest group of that key can
      // take the item, and only inside the window.
      const existing = launches.get(launch);
      if (existing && Math.abs(publishedMs(existing.items[0]) - publishedMs(item)) <= LAUNCH_WINDOW_MS) {
        existing.items.push(item);
        continue;
      }
      const group: LaunchGroup = { kind: "launch", key: `launch:${launch}:${item.id}`, groupKey: launch, lead: item, items: [item] };
      launches.set(launch, group);
      entries.push(group);
      continue;
    }
    entries.push({ kind: "item", key: item.id, item });
  }
  return entries.map((entry): FeedEntry => {
    if (entry.kind === "launch") {
      if (entry.items.length === 1) return { kind: "item", key: entry.items[0].id, item: entry.items[0] };
      const lead = leadOf(entry.items);
      return { ...entry, lead, items: [lead, ...entry.items.filter((item) => item !== lead)] };
    }
    return entry.kind === "releases" && entry.items.length === 1
      ? { kind: "item", key: entry.items[0].id, item: entry.items[0] }
      : entry;
  });
}

// Folds a community item that links to an official update into that update:
// the community item leaves the stream and the official one counts it in
// `coverageCount` (its own source plus each folded item, shown as "N
// nguồn"). Render-time only; nothing is stored. Only an official URL that
// identifies one entry can absorb anything: an entry on a shared page URL
// (several ChatGPT notes under one page, no #anchor) or one URL carried by
// two official items would swallow unrelated links.
export function attachCoverage(items: FeedItem[]): FeedItem[] {
  const byUrl = new Map<string, FeedItem[]>();
  for (const item of items) {
    if (!item.official?.kind) continue;
    const url = canonicalUrl(item.url);
    if (!url || !isEntryUrl(url)) continue;
    byUrl.set(url, [...(byUrl.get(url) ?? []), item]);
  }
  const covered = new Map<string, number>();
  const kept: FeedItem[] = [];
  for (const item of items) {
    if (!item.official?.kind) {
      const url = canonicalUrl(item.url);
      const targets = url ? byUrl.get(url) : undefined;
      if (targets?.length === 1) {
        covered.set(targets[0].id, (covered.get(targets[0].id) ?? 0) + 1);
        continue;
      }
    }
    kept.push(item);
  }
  if (covered.size === 0) return kept;
  return kept.map((item) =>
    covered.has(item.id) ? { ...item, coverageCount: (item.coverageCount ?? 1) + covered.get(item.id)! } : item
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
