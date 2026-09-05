import { NextRequest, NextResponse } from "next/server";
import { recordHomeView, recordItemView, recordLanguageToggle } from "@/lib/dashboardStats";

// Public, unauthenticated by design — low-stakes counters hit by a
// visitor's own browser via sendBeacon, not something worth gating.
export async function POST(request: NextRequest) {
  let payload: { type?: string; itemId?: string; lang?: string };
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "home") {
    await recordHomeView();
  } else if (payload.type === "article" && typeof payload.itemId === "string") {
    await recordItemView(payload.itemId);
  } else if (payload.type === "toggle" && (payload.lang === "en" || payload.lang === "vi")) {
    await recordLanguageToggle(payload.lang);
  } else {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
