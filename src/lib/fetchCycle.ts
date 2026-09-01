import { fetchAnthropicNews } from "@/lib/fetchers/anthropic";
import { fetchGithubReleases, fetchGithubTrending } from "@/lib/fetchers/github";
import { fetchHnItems } from "@/lib/fetchers/hn";
import { fetchRssItems } from "@/lib/fetchers/rss";
import type { SiteSettings } from "@/lib/siteSettings";
import { mergeFreshItems } from "@/lib/store";

// The one place "a full fetch cycle" is defined — called by both the cron
// route's schedule branch and the manual "Fetch now" action. Network-only,
// no AI calls, so it comfortably fits inside one request/invocation.
export async function runFetchCycle(settings: SiteSettings): Promise<{ fetched: number }> {
  const [rss, anthropic, hn, trending, releases] = await Promise.all([
    fetchRssItems(settings.rssItemLimit),
    fetchAnthropicNews(settings.anthropicItemLimit),
    fetchHnItems(settings.hnItemLimit),
    fetchGithubTrending(settings.githubTrendingLimit),
    fetchGithubReleases(settings.watchedRepos, settings.releasesPerRepo),
  ]);

  const fresh = [...rss, ...anthropic, ...hn, ...trending, ...releases];
  await mergeFreshItems(fresh, settings.retentionDays);
  return { fetched: fresh.length };
}
