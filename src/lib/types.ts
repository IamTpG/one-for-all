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
  // Not set by fetchers — populated by aggregate.ts after merging (keyword
  // matching always; Groq classification added on top when configured).
  topics?: string[];
  // True when `summary` was overwritten by Groq rather than being the
  // source's own excerpt/description.
  aiSummary?: boolean;
};

export type AiAnalysis = {
  summary: string;
  topics: string[];
};

export type ActiveFilter =
  | { kind: "type"; value: SourceType | "all" }
  | { kind: "source"; value: string }
  | { kind: "topic"; value: string };

export type SettingsGroup = {
  title: string;
  sources: { name: string; sourceId: string }[];
};
