import { NextRequest, NextResponse } from "next/server";
import { runFetchCycle } from "@/lib/fetchCycle";
import { isCronRequest } from "@/lib/ownerAuth";
import { latestDueSlot, slotDateKey } from "@/lib/schedule";
import { getSiteSettings } from "@/lib/siteSettings";
import { markSlotRan, runAiBackfillTick } from "@/lib/store";

// Verify this against your actual Vercel plan's serverless timeout ceiling
// before deploying — this route is designed to stay well under it either
// way (a fetch cycle is network-only, and the backfill tick is capped by
// AI_BACKFILL_BATCH_SIZE), but the declared ceiling still needs to match
// what your plan actually allows.
export const maxDuration = 60;

// Hit every ~5 minutes (see vercel.json). Two independent, bounded jobs
// per invocation: (1) run one full fetch cycle if the latest due slot
// hasn't run yet — guarded so two near-simultaneous invocations can't
// double-fire, and so downtime through a slot only catches up on that one
// most-recent slot rather than replaying every slot missed meanwhile;
// (2) always process one bounded batch of pending Vietnamese translations,
// regardless of whether a fetch just happened. This is what keeps
// "translate while fetching" true in spirit without ever needing one
// invocation to do a large, slow, synchronous amount of AI work.
export async function GET(request: NextRequest) {
  if (!isCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSiteSettings();
  const now = new Date();

  let fetchResult: { fetched: number } | null = null;
  const slot = latestDueSlot(now, settings.fetchTimesUtc);
  if (slot) {
    const claimed = await markSlotRan(slotDateKey(now, slot), slot);
    if (claimed) fetchResult = await runFetchCycle(settings);
  }

  const backfill = await runAiBackfillTick();

  return NextResponse.json({ fetch: fetchResult, backfillProcessed: backfill.processed });
}
