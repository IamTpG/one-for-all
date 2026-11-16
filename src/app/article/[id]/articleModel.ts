import { resolveLocalized, type Language } from "@/lib/language";
import type { FeedItem } from "@/lib/types";
import { releaseRepo, releaseVersion, repoDisplayName } from "../../feedModel";

// What the client half of the page needs: everything but the body HTML,
// which stays on the server.
export type ArticleItem = Pick<
  FeedItem,
  | "id"
  | "source"
  | "sourceId"
  | "sourceType"
  | "title"
  | "titleVi"
  | "url"
  | "summary"
  | "summaryVi"
  | "publishedAt"
  | "imageUrl"
  | "videoEmbedHtml"
  | "topics"
  | "tag"
  | "points"
  | "firstSeenAt"
  | "lengthMinutes"
>;

// Releases read as "Claude Code v2.1.325" in both languages.
export function displayTitle(item: ArticleItem, language: Language): string {
  if (item.sourceType === "github-release") {
    const repo = releaseRepo(item as FeedItem);
    if (repo) return `${repoDisplayName(repo)} ${releaseVersion(item as FeedItem)}`;
  }
  return resolveLocalized(item.title, item.titleVi, language).text ?? item.title;
}

export function sourceName(item: ArticleItem): string {
  if (item.sourceType === "github-release") return releaseRepo(item as FeedItem) ?? item.source;
  return item.source;
}

export function hnThreadUrl(item: ArticleItem): string | null {
  if (item.sourceType !== "hn" || !item.id.startsWith("hn:")) return null;
  return `https://news.ycombinator.com/item?id=${item.id.slice(3)}`;
}

// A table of contents earns its column only from this many sections.
export const MIN_TOC_SECTIONS = 3;
