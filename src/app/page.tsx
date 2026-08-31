import { cookies } from "next/headers";
import { getAggregatedFeed } from "@/lib/aggregate";
import { CUSTOM_BLOG_SOURCES, RSS_FEEDS, WATCHED_REPOS } from "@/lib/config";
import { slugify } from "@/lib/slug";
import type { SettingsGroup } from "@/lib/types";
import AppShell from "./AppShell";

export const revalidate = 0; // aggregate.ts handles its own caching

export default async function Home() {
  const { items: allItems, fetchedAt } = await getAggregatedFeed();

  const cookieStore = await cookies();
  const disabledFeeds = (cookieStore.get("wire-disabled-feeds")?.value ?? "")
    .split(",")
    .filter(Boolean);
  const disabledSet = new Set(disabledFeeds);
  const items = allItems.filter((item) => !disabledSet.has(item.sourceId));

  const trendingRepos = items
    .filter((item) => item.sourceType === "github-trending")
    .slice(0, 5);

  const topHn = items
    .filter((item) => item.sourceType === "hn")
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 5);

  const feeds = [
    ...RSS_FEEDS.map((feed) => ({ name: feed.name, sourceId: slugify(feed.name) })),
    ...CUSTOM_BLOG_SOURCES,
  ];

  const settingsGroups: SettingsGroup[] = [
    { title: "Blogs", sources: feeds },
    { title: "Hacker News", sources: [{ name: "Hacker News", sourceId: "hacker-news" }] },
    {
      title: "GitHub Trending",
      sources: [{ name: "GitHub Trending", sourceId: "github-trending" }],
    },
    {
      title: "Releases",
      sources: WATCHED_REPOS.map((repo) => ({
        name: repo,
        sourceId: slugify(`${repo}-releases`),
      })),
    },
  ];

  return (
    <AppShell
      items={items}
      feeds={feeds}
      settingsGroups={settingsGroups}
      disabledFeeds={disabledFeeds}
      trendingRepos={trendingRepos}
      topHn={topHn}
      fetchedAt={fetchedAt}
    />
  );
}
