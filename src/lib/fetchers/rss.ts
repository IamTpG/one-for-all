import Parser from "rss-parser";
import { RSS_FEEDS } from "@/lib/config";
import type { FeedItem } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { fetchOgImage, firstImageInHtml } from "@/lib/ogimage";
import { findYoutubeUrl, fetchYoutubeEmbed } from "@/lib/video";

const parser = new Parser();

async function enrichItem(item: FeedItem, rawContent: string | undefined): Promise<FeedItem> {
  const youtubeUrl = findYoutubeUrl(item.url, rawContent);
  if (youtubeUrl) {
    const embed = await fetchYoutubeEmbed(youtubeUrl);
    if (embed) return { ...item, videoEmbedHtml: embed };
  }

  const inlineImage = rawContent ? firstImageInHtml(rawContent) : undefined;
  if (inlineImage) return { ...item, imageUrl: inlineImage };

  const ogImage = await fetchOgImage(item.url);
  if (ogImage) return { ...item, imageUrl: ogImage };

  return item;
}

async function fetchOneFeed(name: string, url: string, limit: number): Promise<FeedItem[]> {
  try {
    const feed = await parser.parseURL(url);
    const sourceId = slugify(name);

    const items = (feed.items ?? []).slice(0, limit).map((item, idx) => {
      const rawContent = item.content;
      const base: FeedItem = {
        id: `rss:${url}:${item.guid ?? item.link ?? idx}`,
        source: name,
        sourceId,
        sourceType: "rss" as const,
        title: item.title ?? "(untitled)",
        url: item.link ?? url,
        summary: stripHtml(item.contentSnippet ?? rawContent ?? ""),
        publishedAt: item.isoDate ?? new Date().toISOString(),
      };
      if (rawContent) {
        base.fullContentHtml = sanitizeArticleHtml(rawContent);
      }
      return { base, rawContent };
    });

    return await Promise.all(
      items.map(({ base, rawContent }) => enrichItem(base, rawContent))
    );
  } catch (err) {
    console.error(`[rss] failed to fetch ${name} (${url}):`, err);
    return [];
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim().slice(0, 280);
}

export async function fetchRssItems(limitPerFeed: number): Promise<FeedItem[]> {
  const results = await Promise.all(
    RSS_FEEDS.map((feed) => fetchOneFeed(feed.name, feed.url, limitPerFeed))
  );
  return results.flat();
}
