import {
  DEFAULT_GITHUB_TRENDING_LIMIT,
  DEFAULT_HN_ITEM_LIMIT,
  DEFAULT_OFFICIAL_ITEM_LIMIT,
  DEFAULT_OFFICIAL_LOOKBACK_DAYS,
  DEFAULT_OFFICIAL_RETENTION_DAYS,
  DEFAULT_RELEASES_PER_REPO,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_RSS_ITEM_LIMIT,
  WATCHED_REPOS,
} from "./config";
import { coerceNumber } from "./limits";
import { getJson, setJson } from "./redis";
import { DEFAULT_FETCH_TIMES_UTC } from "./schedule";

const SETTINGS_KEY = "wire:settings";

export type SiteSettings = {
  disabledFeeds: string[];
  watchedRepos: string[];
  rssItemLimit: number;
  hnItemLimit: number;
  githubTrendingLimit: number;
  releasesPerRepo: number;
  officialItemLimit: number;
  officialLookbackDays: number;
  retentionDays: number;
  officialRetentionDays: number;
  fetchTimesUtc: string[];
};

function defaults(): SiteSettings {
  return {
    disabledFeeds: [],
    watchedRepos: WATCHED_REPOS,
    rssItemLimit: DEFAULT_RSS_ITEM_LIMIT,
    hnItemLimit: DEFAULT_HN_ITEM_LIMIT,
    githubTrendingLimit: DEFAULT_GITHUB_TRENDING_LIMIT,
    releasesPerRepo: DEFAULT_RELEASES_PER_REPO,
    officialItemLimit: DEFAULT_OFFICIAL_ITEM_LIMIT,
    officialLookbackDays: DEFAULT_OFFICIAL_LOOKBACK_DAYS,
    retentionDays: DEFAULT_RETENTION_DAYS,
    officialRetentionDays: DEFAULT_OFFICIAL_RETENTION_DAYS,
    fetchTimesUtc: DEFAULT_FETCH_TIMES_UTC,
  };
}

// Shared across every visitor — not a per-browser cookie. Falls back to
// config defaults if Redis is unconfigured/unreachable or nothing has been
// saved yet, same behavior as before this feature existed.
export async function getSiteSettings(): Promise<SiteSettings> {
  const stored = await getJson<Partial<SiteSettings>>(SETTINGS_KEY);
  const base = defaults();
  if (!stored) return base;

  return {
    disabledFeeds: Array.isArray(stored.disabledFeeds) ? stored.disabledFeeds : base.disabledFeeds,
    watchedRepos: Array.isArray(stored.watchedRepos) ? stored.watchedRepos : base.watchedRepos,
    rssItemLimit: coerceNumber(stored.rssItemLimit, base.rssItemLimit),
    hnItemLimit: coerceNumber(stored.hnItemLimit, base.hnItemLimit),
    githubTrendingLimit: coerceNumber(stored.githubTrendingLimit, base.githubTrendingLimit),
    releasesPerRepo: coerceNumber(stored.releasesPerRepo, base.releasesPerRepo),
    officialItemLimit: coerceNumber(stored.officialItemLimit, base.officialItemLimit),
    officialLookbackDays: coerceNumber(stored.officialLookbackDays, base.officialLookbackDays),
    retentionDays: coerceNumber(stored.retentionDays, base.retentionDays),
    officialRetentionDays: coerceNumber(stored.officialRetentionDays, base.officialRetentionDays),
    fetchTimesUtc: Array.isArray(stored.fetchTimesUtc) && stored.fetchTimesUtc.length > 0
      ? stored.fetchTimesUtc
      : base.fetchTimesUtc,
  };
}

export async function setSiteSettings(settings: SiteSettings): Promise<boolean> {
  return setJson(SETTINGS_KEY, settings);
}
