"use server";

import { cookies } from "next/headers";
import { runFetchCycle } from "@/lib/fetchCycle";
import { isOwnerRequest, OWNER_COOKIE_NAME } from "@/lib/ownerAuth";
import { getSiteSettings } from "@/lib/siteSettings";
import { runAiBackfillTick } from "@/lib/store";

// Owner-gated manual trigger — runs the same fetch cycle + one backfill
// tick the cron endpoint does, in-process (no HTTP round trip, no
// CRON_SECRET needed since the cookie check already gates it). Doubles as
// the local-dev testing tool, since there's no real Vercel Cron locally.
export async function triggerFetchNowAction(): Promise<{ ok: boolean; fetched?: number }> {
  const cookieStore = await cookies();
  if (!isOwnerRequest(cookieStore.get(OWNER_COOKIE_NAME)?.value)) return { ok: false };

  const settings = await getSiteSettings();
  const { fetched } = await runFetchCycle(settings);
  await runAiBackfillTick();
  return { ok: true, fetched };
}
