import { HN_STORY_LIMIT } from "@/lib/config";
import type { FeedItem } from "@/lib/types";
import { fetchOgImage } from "@/lib/ogimage";

type HnItem = {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  time?: number;
  type?: string;
};

async function toFeedItem(item: HnItem): Promise<FeedItem> {
  const url = item.url ?? `https://news.ycombinator.com/item?id=${item.id}`;
  const base: FeedItem = {
    id: `hn:${item.id}`,
    source: "Hacker News",
    sourceId: "hacker-news",
    sourceType: "hn" as const,
    title: item.title!,
    url,
    publishedAt: item.time
      ? new Date(item.time * 1000).toISOString()
      : new Date().toISOString(),
    points: item.score,
  };

  if (item.url) {
    const imageUrl = await fetchOgImage(item.url);
    if (imageUrl) return { ...base, imageUrl };
  }
  return base;
}

export async function fetchHnItems(): Promise<FeedItem[]> {
  try {
    const idsRes = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { cache: "no-store" }
    );
    const ids: number[] = await idsRes.json();
    const topIds = ids.slice(0, HN_STORY_LIMIT);

    const rawItems = await Promise.all(
      topIds.map(async (id) => {
        const res = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
          { cache: "no-store" }
        );
        return (await res.json()) as HnItem;
      })
    );

    return await Promise.all(
      rawItems.filter((item) => item && item.title).map(toFeedItem)
    );
  } catch (err) {
    console.error("[hn] failed to fetch top stories:", err);
    return [];
  }
}
