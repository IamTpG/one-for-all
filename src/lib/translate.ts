import { AI_CACHE_TTL_SECONDS, TRANSLATE_MAX_CHARS } from "@/lib/config";
import { recordGroqFailure } from "@/lib/dashboardStats";
import { translateArticleHtml } from "@/lib/groq";
import { getJson, setJson } from "@/lib/redis";

const KEY_PREFIX = "wire:translation:";

// Lazy, on-demand, cached forever (like the AI summary cache) — an article
// is only ever translated the first time someone actually opens it in
// Vietnamese, never during aggregation.
export async function getArticleTranslation(itemId: string, html: string): Promise<string | null> {
  const cached = await getJson<string>(KEY_PREFIX + itemId);
  if (cached) return cached;

  const { data: translated, error } = await translateArticleHtml(itemId, html.slice(0, TRANSLATE_MAX_CHARS));
  if (error) {
    await recordGroqFailure({ ts: Date.now(), stage: "translate", itemId, message: error });
  }
  if (!translated) return null;

  await setJson(KEY_PREFIX + itemId, translated, AI_CACHE_TTL_SECONDS);
  return translated;
}
