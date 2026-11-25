import { recordFetchRun } from "@/lib/dashboardStats";
import { fetchGithubReleases, fetchGithubTrending } from "@/lib/fetchers/github";
import { fetchHnItems } from "@/lib/fetchers/hn";
import { fetchRssItems } from "@/lib/fetchers/rss";
import { fetchOfficialSources } from "@/lib/official/fetch";
import { loadValidators, OFFICIAL_RELEASE_SOURCE_IDS, recordOfficialOutcome } from "@/lib/official/state";
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
): Promise<{ fetched: number; newItems: number }> {
  const startedAt = Date.now();
  const validators = await loadValidators();
  const [rss, official, hn, trending, releases] = await Promise.all([
    fetchRssItems(settings.rssItemLimit),
    fetchOfficialSources(settings, startedAt, validators),
    fetchHnItems(settings.hnItemLimit),
    fetchGithubTrending(settings.githubTrendingLimit),
    fetchGithubReleases(settings.watchedRepos, settings.releasesPerRepo, {
      limit: settings.officialItemLimit,
      lookbackDays: settings.officialLookbackDays,
      disabledFeeds: settings.disabledFeeds,
      validators,
    }),
  ]);

  const allResults = [...rss, ...official, ...hn, ...trending, ...releases];
  const officialResults = [...official, ...releases.filter((r) => OFFICIAL_RELEASE_SOURCE_IDS.has(r.sourceId))];
  const fresh = allResults.flatMap((result) => result.items);
  const { newItems, newBySource, ok: merged } = await mergeFreshItems(fresh, {
    retentionDays: settings.retentionDays,
    officialRetentionDays: settings.officialRetentionDays,
    officialLookbackDays: settings.officialLookbackDays,
  });

  await recordOfficialOutcome(officialResults, startedAt, merged);

  await recordFetchRun({
    ts: startedAt,
    slot,
    durationMs: Date.now() - startedAt,
    totalFetched: fresh.length,
    newItems,
    // The stored validator is bookkeeping, not history: leave it out.
    sources: allResults.map((result) => ({
      sourceId: result.sourceId,
      label: result.label,
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
      ...(result.notModified ? { notModified: true } : {}),
      count: result.items.length,
      newItems: newBySource[result.sourceId] ?? 0,
    })),
  });

  return { fetched: fresh.length, newItems };
}
