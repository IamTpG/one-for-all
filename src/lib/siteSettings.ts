import { WATCHED_REPOS } from "./config";
import { getJson, setJson } from "./redis";

const SETTINGS_KEY = "wire:settings";

export type SiteSettings = {
  disabledFeeds: string[];
  watchedRepos: string[];
};

function defaults(): SiteSettings {
  return { disabledFeeds: [], watchedRepos: WATCHED_REPOS };
}

// Shared across every visitor — not a per-browser cookie. Falls back to
// config defaults if Redis is unconfigured/unreachable or nothing has been
// saved yet, same behavior as before this feature existed.
export async function getSiteSettings(): Promise<SiteSettings> {
  const stored = await getJson<Partial<SiteSettings>>(SETTINGS_KEY);
  if (!stored) return defaults();
  return {
    disabledFeeds: Array.isArray(stored.disabledFeeds) ? stored.disabledFeeds : [],
    watchedRepos: Array.isArray(stored.watchedRepos) ? stored.watchedRepos : WATCHED_REPOS,
  };
}

export async function setSiteSettings(settings: SiteSettings): Promise<boolean> {
  return setJson(SETTINGS_KEY, settings);
}
