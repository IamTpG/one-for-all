import { CUSTOM_BLOG_SOURCES, RSS_FEEDS } from "@/lib/config";
import { slugify } from "@/lib/slug";
import type { SettingsGroup } from "@/lib/types";

// Shared by the home page's sidebar nav and the settings page's source
// toggles, so the two stay in sync automatically.
export function buildFeedsList(): { name: string; sourceId: string }[] {
  return [
    ...RSS_FEEDS.map((feed) => ({ name: feed.name, sourceId: slugify(feed.name) })),
    ...CUSTOM_BLOG_SOURCES,
  ];
}

export function buildSettingsGroups(watchedRepos: string[]): SettingsGroup[] {
  return [
    { title: "Blogs", sources: buildFeedsList() },
    { title: "Hacker News", sources: [{ name: "Hacker News", sourceId: "hacker-news" }] },
    {
      title: "GitHub Trending",
      sources: [{ name: "GitHub Trending", sourceId: "github-trending" }],
    },
    {
      title: "Releases",
      sources: watchedRepos.map((repo) => ({
        name: repo,
        sourceId: slugify(`${repo}-releases`),
      })),
    },
  ];
}
