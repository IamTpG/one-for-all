"use server";

import { cookies } from "next/headers";
import { cleanStringList, coerceWholeLimits, FETCH_TIME_PATTERN, REPO_PATTERN, SOURCE_ID_PATTERN } from "@/lib/limits";
import { isOwnerRequest, OWNER_COOKIE_NAME } from "@/lib/ownerAuth";
import { getSiteSettings, setSiteSettings } from "@/lib/siteSettings";

async function requireOwner(): Promise<boolean> {
  const cookieStore = await cookies();
  return isOwnerRequest(cookieStore.get(OWNER_COOKIE_NAME)?.value);
}

// Server Actions are callable regardless of whether the UI that normally
// triggers them is rendered, so the owner check happens here — not just by
// hiding the settings panel from non-owners. None of these ever trigger a
// fetch — only triggerFetchNowAction (actions/cron.ts) and the cron route
// call runFetchCycle; a settings change only affects the *next* one.
export async function setDisabledFeedsAction(sourceIds: string[]): Promise<{ ok: boolean }> {
  if (!(await requireOwner())) return { ok: false };
  const checked = cleanStringList(sourceIds, SOURCE_ID_PATTERN, 500);
  if (!checked) return { ok: false };
  const current = await getSiteSettings();
  const ok = await setSiteSettings({ ...current, disabledFeeds: checked });
  return { ok };
}

export async function setWatchedReposAction(repos: string[]): Promise<{ ok: boolean }> {
  if (!(await requireOwner())) return { ok: false };
  const checked = cleanStringList(repos, REPO_PATTERN);
  if (!checked) return { ok: false };
  const current = await getSiteSettings();
  const ok = await setSiteSettings({ ...current, watchedRepos: checked });
  return { ok };
}

export type SourceLimits = {
  rssItemLimit: number;
  hnItemLimit: number;
  githubTrendingLimit: number;
  releasesPerRepo: number;
  officialItemLimit: number;
  officialLookbackDays: number;
};

export async function setSourceLimitsAction(limits: SourceLimits): Promise<{ ok: boolean }> {
  if (!(await requireOwner())) return { ok: false };
  const current = await getSiteSettings();
  // A server action takes whatever the client sends: anything that is not a
  // whole number of at least 1 keeps the stored value.
  const checked = coerceWholeLimits<SourceLimits>(limits, {
    rssItemLimit: current.rssItemLimit,
    hnItemLimit: current.hnItemLimit,
    githubTrendingLimit: current.githubTrendingLimit,
    releasesPerRepo: current.releasesPerRepo,
    officialItemLimit: current.officialItemLimit,
    officialLookbackDays: current.officialLookbackDays,
  });
  const ok = await setSiteSettings({ ...current, ...checked });
  return { ok };
}

export type Retention = { retentionDays: number; officialRetentionDays: number };

export async function setRetentionDaysAction(retention: Retention): Promise<{ ok: boolean }> {
  if (!(await requireOwner())) return { ok: false };
  const current = await getSiteSettings();
  const checked = coerceWholeLimits<Retention>(retention, {
    retentionDays: current.retentionDays,
    officialRetentionDays: current.officialRetentionDays,
  });
  const ok = await setSiteSettings({ ...current, ...checked });
  return { ok };
}

export async function setFetchTimesAction(fetchTimesUtc: string[]): Promise<{ ok: boolean }> {
  if (!(await requireOwner())) return { ok: false };
  const checked = cleanStringList(fetchTimesUtc, FETCH_TIME_PATTERN, 24);
  if (!checked || checked.length === 0) return { ok: false };
  const current = await getSiteSettings();
  const ok = await setSiteSettings({ ...current, fetchTimesUtc: checked });
  return { ok };
}
