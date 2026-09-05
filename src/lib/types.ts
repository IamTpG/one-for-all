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
  // Vietnamese translations of title/summary, computed alongside the
  // English summary (same Groq call) and cached the same way. Absent
  // until Groq processes the item, or if the translation half of that
  // call failed while the English half still succeeded.
  titleVi?: string;
  summaryVi?: string;
};

// What one logical source (a single RSS feed, HN, a single watched repo's
// releases, ...) produced on one fetch cycle attempt — carries success/
// failure through to the dashboard instead of swallowing it into a
// console.error and an empty array.
export type FetchSourceResult = {
  sourceId: string;
  label: string;
  items: FeedItem[];
  ok: boolean;
  error?: string;
  meta?: Record<string, string | number>;
};

export type AiAnalysis = {
  summary: string;
  topics: string[];
  titleVi?: string;
  summaryVi?: string;
};

export type ActiveFilter =
  | { kind: "type"; value: SourceType | "all" }
  | { kind: "source"; value: string }
  | { kind: "topic"; value: string };

export type SettingsGroup = {
  title: string;
  sources: { name: string; sourceId: string }[];
};
