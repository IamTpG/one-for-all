import { RSS_FEEDS } from "@/lib/config";
import { OFFICIAL_SOURCES_REGISTRY, PUBLISHERS } from "@/lib/sourceRegistry";
import { withOfficialRepos } from "@/lib/official/filters";
import { OFFICIAL_REPOS } from "@/lib/official/sources";
import { slugify } from "@/lib/slug";
import type { SettingsGroup } from "@/lib/types";

// Shared by the home page's sidebar nav and the settings page's source
// toggles, so the two stay in sync automatically.
export function buildFeedsList(): { name: string; sourceId: string }[] {
  return [
    ...RSS_FEEDS.map((feed) => ({ name: feed.name, sourceId: slugify(feed.name) })),
    ...OFFICIAL_SOURCES_REGISTRY.map((source) => ({ name: source.name, sourceId: source.id })),
  ];
}

export function buildSettingsGroups(watchedRepos: string[]): SettingsGroup[] {
  const feeds = buildFeedsList();
  const official = new Set(OFFICIAL_SOURCES_REGISTRY.map((source) => source.id));
  // One group per publisher, in the registry's order. A source switched off
  // here is not fetched at all.
  const publisherGroups: SettingsGroup[] = Object.entries(PUBLISHERS).flatMap(([publisher, { name }]) => {
    const sources = OFFICIAL_SOURCES_REGISTRY.filter((source) => source.publisher === publisher).map((source) => ({
      name: source.name,
      sourceId: source.id,
    }));
    return sources.length > 0 ? [{ title: `${name} (official)`, sources }] : [];
  });
  return [
    { title: "Blogs", sources: feeds.filter((feed) => !official.has(feed.sourceId)) },
    ...publisherGroups,
    { title: "Hacker News", sources: [{ name: "Hacker News", sourceId: "hacker-news" }] },
    {
      title: "GitHub Trending",
      sources: [{ name: "GitHub Trending", sourceId: "github-trending" }],
    },
    {
      title: "Releases",
      sources: withOfficialRepos(watchedRepos, Object.keys(OFFICIAL_REPOS)).map((repo) => ({
        name: repo,
        sourceId: slugify(`${repo}-releases`),
      })),
    },
  ];
}
