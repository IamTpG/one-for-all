// Relative imports with extensions: this module and the filter logic built
// on it run under `node --test`, which knows nothing about the "@/" alias.
import { RSS_FEEDS } from "./config.ts";
import { slugify } from "./slug.ts";
import type { FeedItem, PublisherId } from "./types.ts";

// Plain data, safe to import from client code: which sources exist, whether
// they are the vendor's own ("official") or third-party ("community"), and
// who published them. How an official source is fetched lives in
// official/sources.ts, keyed by the same id.

export type SourceKind = "official" | "community";

export const PUBLISHERS: Record<PublisherId, { name: string }> = {
  anthropic: { name: "Anthropic" },
  openai: { name: "OpenAI" },
  google: { name: "Google" },
  xai: { name: "xAI" },
};

export type RegistrySource = {
  id: string;
  kind: SourceKind;
  publisher: PublisherId | null;
  name: string;
  // Release-note pages, where every entry is an update (official/sources.ts
  // holds the same fact as `class: "changelog"` and checks they agree).
  changelog?: true;
};

// Official feeds. OpenAI News and Anthropic keep the sourceIds they had as
// community sources, so their stored items, cached analyses and
// disabledFeeds entries carry over. Official GitHub repos are not listed
// here: their releases are keyed by repo (see OFFICIAL_REPOS).
export const OFFICIAL_SOURCES_REGISTRY: RegistrySource[] = [
  { id: "anthropic", kind: "official", publisher: "anthropic", name: "Anthropic" },
  { id: "claude-platform-release-notes", kind: "official", publisher: "anthropic", name: "Claude Platform release notes", changelog: true },
  { id: "claude-articles", kind: "official", publisher: "anthropic", name: "Claude articles" },
  { id: "claude-apps-release-notes", kind: "official", publisher: "anthropic", name: "Claude apps release notes", changelog: true },
  { id: "openai-news", kind: "official", publisher: "openai", name: "OpenAI News" },
  { id: "codex-changelog", kind: "official", publisher: "openai", name: "ChatGPT & Codex changelog", changelog: true },
  { id: "chatgpt-release-notes", kind: "official", publisher: "openai", name: "ChatGPT release notes", changelog: true },
  { id: "openai-model-release-notes", kind: "official", publisher: "openai", name: "OpenAI model release notes", changelog: true },
  { id: "openai-api-changelog", kind: "official", publisher: "openai", name: "OpenAI API changelog", changelog: true },
  { id: "google-developers-blog", kind: "official", publisher: "google", name: "Google developer tools blog" },
  { id: "google-deepmind-blog", kind: "official", publisher: "google", name: "Google DeepMind blog" },
  { id: "gemini-api-changelog", kind: "official", publisher: "google", name: "Gemini API changelog", changelog: true },
  { id: "xai-release-notes", kind: "official", publisher: "xai", name: "xAI API release notes", changelog: true },
  { id: "xai-news", kind: "official", publisher: "xai", name: "xAI News" },
];

const CHANGELOG_SOURCE_IDS: ReadonlySet<string> = new Set(
  OFFICIAL_SOURCES_REGISTRY.filter((source) => source.changelog).map((source) => source.id)
);

export function isChangelogSource(sourceId: string): boolean {
  return CHANGELOG_SOURCE_IDS.has(sourceId);
}

export const GITHUB_RELEASES_ID = "github-releases";

export function communitySources(): RegistrySource[] {
  return [
    ...RSS_FEEDS.map((feed) => ({
      id: slugify(feed.name),
      kind: "community" as const,
      publisher: null,
      name: feed.name,
    })),
    { id: "hacker-news", kind: "community", publisher: null, name: "Hacker News" },
    { id: "github-trending", kind: "community", publisher: null, name: "GitHub Trending" },
    // Releases of every watched repo that is not an official one; the
    // official repos' releases belong to their publisher.
    { id: GITHUB_RELEASES_ID, kind: "community", publisher: null, name: "GitHub releases" },
  ];
}

export function allRegistrySources(): RegistrySource[] {
  return [...communitySources(), ...OFFICIAL_SOURCES_REGISTRY];
}

// ---------- What the source filter offers and what an item answers to ----------

export type FilterOption = { id: string; name: string };
export type FilterOptions = { official: FilterOption[]; community: FilterOption[] };

const OFFICIAL_SOURCE_IDS: ReadonlySet<string> = new Set(OFFICIAL_SOURCES_REGISTRY.map((source) => source.id));

// The two groups of the source dropdown. Official options are publishers
// (a publisher with registered sources shows only while one of them is
// enabled; one without any registered source yet is still listed), community
// options are single sources. `disabled` holds the sourceIds switched off in
// Settings.
export function filterOptions(disabled: ReadonlySet<string> = new Set()): FilterOptions {
  const official: FilterOption[] = [];
  for (const [id, publisher] of Object.entries(PUBLISHERS)) {
    const sources = OFFICIAL_SOURCES_REGISTRY.filter((source) => source.publisher === id);
    if (sources.length > 0 && sources.every((source) => disabled.has(source.id))) continue;
    official.push({ id, name: publisher.name });
  }
  const community = communitySources()
    .filter((source) => !disabled.has(source.id))
    .map(({ id, name }) => ({ id, name }));
  return { official, community };
}

export function allOptionIds(options: FilterOptions): string[] {
  return [...options.official, ...options.community].map((option) => option.id);
}

// The filter id an item answers to, or null when no option selects it:
//  - an official update answers to its publisher;
//  - an item from an official source that is not an update (a customer
//    story on a vendor blog) answers to nothing, so it shows only when no
//    source is selected;
//  - a release of a non-official watched repo answers to "github-releases";
//  - everything else answers to its own source.
export function itemFilterKey(
  item: Pick<FeedItem, "sourceId" | "sourceType" | "official">
): string | null {
  if (item.official?.kind) return item.official.publisher;
  if (item.official || OFFICIAL_SOURCE_IDS.has(item.sourceId)) return null;
  if (item.sourceType === "github-release") return GITHUB_RELEASES_ID;
  return item.sourceId;
}
