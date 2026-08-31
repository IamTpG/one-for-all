export type SourceType = "rss" | "hn" | "github-trending" | "github-release";

export type FeedItem = {
  id: string;
  source: string;
  sourceId: string;
  sourceType: SourceType;
  title: string;
  url: string;
  summary?: string;
  publishedAt: string; // ISO timestamp
  points?: number;
  tag?: string;
  imageUrl?: string;
  videoEmbedHtml?: string;
  fullContentHtml?: string;
};

export type ActiveFilter =
  | { kind: "type"; value: SourceType | "all" }
  | { kind: "source"; value: string };

export type SettingsGroup = {
  title: string;
  sources: { name: string; sourceId: string }[];
};
