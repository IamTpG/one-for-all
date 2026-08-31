import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { EXTRACT_CACHE_TTL_MS } from "@/lib/config";
import { fetchWithTimeout } from "@/lib/http";
import { sanitizeArticleHtml } from "@/lib/sanitize";

const cache = new Map<string, { html: string; fetchedAt: number }>();

export async function extractArticle(url: string): Promise<string | null> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.fetchedAt < EXTRACT_CACHE_TTL_MS) {
    return cached.html;
  }

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const html = await res.text();

    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (!article?.content) return null;

    const sanitized = sanitizeArticleHtml(article.content);
    cache.set(url, { html: sanitized, fetchedAt: Date.now() });
    return sanitized;
  } catch (err) {
    console.error(`[extract] failed to extract ${url}:`, err);
    return null;
  }
}
