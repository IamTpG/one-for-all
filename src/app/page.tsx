import { cookies } from "next/headers";
import { isOwnerRequest, OWNER_COOKIE_NAME } from "@/lib/ownerAuth";
import { buildFeedsList } from "@/lib/settingsGroups";
import { getSiteSettings } from "@/lib/siteSettings";
import { filterByWatchedRepos, getLastFetchAt, getStoredItems } from "@/lib/store";
import AppShell from "./AppShell";

export const revalidate = 0; // reads the persistent store directly, always fresh

export default async function Home() {
  const cookieStore = await cookies();
  const isOwner = isOwnerRequest(cookieStore.get(OWNER_COOKIE_NAME)?.value);

  const { disabledFeeds, watchedRepos } = await getSiteSettings();
  const [allItems, fetchedAt] = await Promise.all([getStoredItems(), getLastFetchAt()]);

  const disabledSet = new Set(disabledFeeds);
  const items = filterByWatchedRepos(allItems, watchedRepos).filter(
    (item) => !disabledSet.has(item.sourceId)
  );

  const trendingRepos = items
    .filter((item) => item.sourceType === "github-trending")
    .slice(0, 5);

  const topHn = items
    .filter((item) => item.sourceType === "hn")
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 5);

  return (
    <AppShell
      items={items}
      feeds={buildFeedsList()}
      isOwner={isOwner}
      trendingRepos={trendingRepos}
      topHn={topHn}
      fetchedAt={fetchedAt}
    />
  );
}
