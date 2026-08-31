import { fetchWithTimeout } from "@/lib/http";

const FIRST_IMG_RE = /<img[^>]+src=["']([^"']+)["']/i;
const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_RE_REVERSED = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;

export function firstImageInHtml(html: string): string | undefined {
  const match = html.match(FIRST_IMG_RE);
  return match?.[1];
}

export async function fetchOgImage(pageUrl: string): Promise<string | undefined> {
  try {
    const res = await fetchWithTimeout(pageUrl);
    if (!res.ok) return undefined;
    const html = await res.text();
    const match = html.match(OG_IMAGE_RE) ?? html.match(OG_IMAGE_RE_REVERSED);
    return match?.[1];
  } catch {
    return undefined;
  }
}
