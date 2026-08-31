import { getAggregatedFeed } from "@/lib/aggregate";
import { CUSTOM_BLOG_SOURCES, RSS_FEEDS } from "@/lib/config";
import { slugify } from "@/lib/slug";
import AppShell from "./AppShell";

export const revalidate = 0; // aggregate.ts handles its own caching

export default async function Home() {
  const { items, fetchedAt } = await getAggregatedFeed();

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

  return (
    <AppShell
      items={items}
      feeds={feeds}
      trendingRepos={trendingRepos}
      topHn={topHn}
      fetchedAt={fetchedAt}
    />
  );
}
