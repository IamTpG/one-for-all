import { cookies } from "next/headers";
import { isOwnerRequest, OWNER_COOKIE_NAME } from "@/lib/ownerAuth";
import { getOfficialHealthRows } from "@/lib/official/state";
import { getSiteSettings } from "@/lib/siteSettings";
import { filterByWatchedRepos, getLastFetchAt, getStoredItems } from "@/lib/store";
import { attachCoverage } from "./feedModel";
import AppShell from "./AppShell";

export const revalidate = 0; // reads the persistent store directly, always fresh

export default async function Home() {
  const cookieStore = await cookies();
  const isOwner = isOwnerRequest(cookieStore.get(OWNER_COOKIE_NAME)?.value);

  const { disabledFeeds, watchedRepos, retentionDays } = await getSiteSettings();
  const [allItems, fetchedAt, officialHealth] = await Promise.all([
    getStoredItems(),
    getLastFetchAt(),
    getOfficialHealthRows(disabledFeeds),
  ]);
  // Enabled official sources whose last run failed (drives the note above the feed).
  const officialFailures = officialHealth.filter((row) => (row.health?.consecutiveFailures ?? 0) > 0).length;

  const disabledSet = new Set(disabledFeeds);
  // Community items that link to an official update fold into it (render-time).
  const items = attachCoverage(
    filterByWatchedRepos(allItems, watchedRepos).filter((item) => !disabledSet.has(item.sourceId))
  );

  return (
    <AppShell
      items={items}
      disabledFeeds={disabledFeeds}
      isOwner={isOwner}
      fetchedAt={fetchedAt}
      retentionDays={retentionDays}
      officialFailures={officialFailures}
    />
  );
}
