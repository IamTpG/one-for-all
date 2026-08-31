"use server";

import { cookies } from "next/headers";
import { isOwnerRequest, OWNER_COOKIE_NAME } from "@/lib/ownerAuth";
import { getSiteSettings, setSiteSettings } from "@/lib/siteSettings";

async function requireOwner(): Promise<boolean> {
  const cookieStore = await cookies();
  return isOwnerRequest(cookieStore.get(OWNER_COOKIE_NAME)?.value);
}

// Server Actions are callable regardless of whether the UI that normally
// triggers them is rendered, so the owner check happens here — not just by
// hiding the settings panel from non-owners.
export async function setDisabledFeedsAction(sourceIds: string[]): Promise<{ ok: boolean }> {
  if (!(await requireOwner())) return { ok: false };
  const current = await getSiteSettings();
  const ok = await setSiteSettings({ ...current, disabledFeeds: sourceIds });
  return { ok };
}

export async function setWatchedReposAction(repos: string[]): Promise<{ ok: boolean }> {
  if (!(await requireOwner())) return { ok: false };
  const current = await getSiteSettings();
  const ok = await setSiteSettings({ ...current, watchedRepos: repos });
  return { ok };
}
