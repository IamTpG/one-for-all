import { FETCH_TIMEOUT_MS } from "@/lib/config";

const USER_AGENT =
  "Mozilla/5.0 (compatible; WireFeedReader/1.0; +personal RSS reader)";

// Identifies this reader to the vendors whose release notes it polls (no
// personal contact data).
export const OFFICIAL_USER_AGENT = "OneForAll/1.0 (+personal news reader)";

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
  } finally {
    clearTimeout(timer);
  }
}
