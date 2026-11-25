import type { SourceValidator } from "@/lib/official/validators";

// "changelog" (parsed release-note pages) joins this union in Phase 3, with its UI copy.
export type SourceType = "rss" | "hn" | "github-trending" | "github-release" | "changelog";

// Who published an official update ("anthropic", "openai", "google", "xai").
// Registry-driven: see sourceRegistry.ts.
export type PublisherId = string;

export type UpdateKind =
  | "model-release"
  | "feature"
  | "tool-release"
  | "api-change"
  | "deprecation"
  | "pricing";

// Set on items that come from a vendor's own release notes, changelog or
// news. Trust comes from the source (the URL's owner), never from the text.
export type OfficialInfo = {
  publisher: PublisherId;
  // undefined = not (yet) judged a product update (news-class sources).
  kind?: UpdateKind;
  kindFrom: "source" | "keyword" | "groq";
  // "Claude Code", "Codex", "Claude Platform"... (from the source config)
  product?: string;
  // Set when only the month is known (xAI release notes).
  dateApprox?: "month";
  // Filled by the official summarising prompt: a headline that replaces a
  // generic title ("2.1.331"), who gets the change ("Pro, Max, Team · Web"),
  // and the date a rollout, retirement or price change takes effect (YYYY-MM-DD).
  headline?: string;
  availability?: string;
  effectiveDate?: string;
  // Lowercase slug of the main model/product/feature ("gemini-4-neon"): two
  // posts of one publisher with the same key within a week are one launch.
  launchKey?: string;
};

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
  // When the store first saw this item (ms). Drives "new since your last
  // visit": publish time alone misses items fetched hours after they were
  // published. Absent on items that never went through the store.
  firstSeenAt?: number;
  // Not produced by the pipeline yet. The home feed renders each one only
  // when present, so they can be filled in later without a redesign.
  // Present on official-source items; drives the on-topic gate and the
  // retention window (see store.ts).
  official?: OfficialInfo;
  entities?: string[];
  contentType?: "tool" | "release" | "workflow" | "career" | "industry" | "case-study";
  coverageCount?: number;
  lengthMinutes?: number;
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
  // The source answered 304 to a conditional request: ok, nothing new, and
  // not a sign of an empty source.
  notModified?: boolean;
  // Entries the source returned before the lookback cut (health only).
  parsed?: number;
  // Validators to store for the next conditional request. Internal to the
  // fetch cycle: never recorded in the run history.
  validator?: SourceValidator;
};

export type AiAnalysis = {
  summary: string;
  topics: string[];
  titleVi?: string;
  summaryVi?: string;
  // Only from the official prompt. "none" = not a product change (customer
  // story, policy, research essay, event, hiring).
  kind?: UpdateKind | "none";
  headline?: string;
  availability?: string;
  effectiveDate?: string;
  launchKey?: string;
};

export type SettingsGroup = {
  title: string;
  sources: { name: string; sourceId: string }[];
};
