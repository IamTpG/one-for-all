import { NextRequest, NextResponse } from "next/server";
import { extractArticle } from "@/lib/extract";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Missing or invalid url" }, { status: 400 });
  }

  const html = await extractArticle(url);
  if (!html) {
    return NextResponse.json({ error: "Could not extract article" }, { status: 502 });
  }

  return NextResponse.json({ html });
}
