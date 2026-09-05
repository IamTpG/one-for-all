import { recordFetchRun } from "@/lib/dashboardStats";
import { fetchAnthropicNews } from "@/lib/fetchers/anthropic";
import { fetchGithubReleases, fetchGithubTrending } from "@/lib/fetchers/github";
import { fetchHnItems } from "@/lib/fetchers/hn";
import { fetchRssItems } from "@/lib/fetchers/rss";
import type { SiteSettings } from "@/lib/siteSettings";
import { mergeFreshItems } from "@/lib/store";

// The one place "a full fetch cycle" is defined — called by both the cron
// route's schedule branch and the manual "Fetch now" action. Network-only,
// no AI calls, so it comfortably fits inside one request/invocation. `slot`
// is the scheduled UTC time this run corresponds to, or null for a manual
// trigger — recorded alongside the run for the dashboard, nothing else
// depends on it.
export async function runFetchCycle(
  settings: SiteSettings,
  slot: string | null = null
): Promise<{ fetched: number }> {
  const startedAt = Date.now();
  const [rss, anthropic, hn, trending, releases] = await Promise.all([
    fetchRssItems(settings.rssItemLimit),
    fetchAnthropicNews(settings.anthropicItemLimit),
    fetchHnItems(settings.hnItemLimit),
    fetchGithubTrending(settings.githubTrendingLimit),
    fetchGithubReleases(settings.watchedRepos, settings.releasesPerRepo),
  ]);

  const allResults = [...rss, ...anthropic, ...hn, ...trending, ...releases];
  const fresh = allResults.flatMap((result) => result.items);
  await mergeFreshItems(fresh, settings.retentionDays);

  await recordFetchRun({
    ts: startedAt,
    slot,
    durationMs: Date.now() - startedAt,
    totalFetched: fresh.length,
    sources: allResults.map(({ items, ...rest }) => ({ ...rest, count: items.length })),
  });

  return { fetched: fresh.length };
}
