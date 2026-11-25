import { OFFICIAL_SOURCES_REGISTRY } from "@/lib/sourceRegistry";
import type { FeedItem, PublisherId, UpdateKind } from "@/lib/types";
import type { MergeContext } from "@/lib/official/analysis";
import type { KindRule } from "@/lib/official/kind";

// Server-side fetch config for the official sources in sourceRegistry.ts
// (same ids). Never import this from client components.

export type OfficialFormat =
  | "rss"
  | "anthropic-news"
  | "intercom-html"
  | "md-openai-changelog"
  | "md-dated"
  | "md-month"
  | "xai-news";

export type OfficialSourceConfig = {
  id: string;
  publisher: PublisherId;
  name: string;
  product?: string;
  // What is requested. Markdown sources point at the page's .md twin.
  url: string;
  // The page a reader opens, when it differs from `url` (entry links start
  // here). Defaults to `url`.
  pageUrl?: string;
  format: OfficialFormat;
  // xai-news: sitemap that gives the dates the cards do not show.
  sitemapUrl?: string;
  // Sources that share a value are fetched one after another, 1 s apart
  // (help.openai.com and support.claude.com ask for a crawl delay of 1).
  sequentialGroup?: string;
  // changelog: every entry is an official update. news: a vendor blog where
  // an entry only counts as an update once it has a kind.
  class: "changelog" | "news";
  defaultKind?: UpdateKind;
  kindRules?: KindRule[];
  // Keep only entries with one of these categories ("" = no category).
  allowCategories?: string[];
  // Drop entries whose URL contains one of these.
  excludeUrlParts?: string[];
  // Both the request (every redirect hop) and each entry URL must stay on
  // these hosts, or the source fails / the entry is dropped.
  hostAllowlist: string[];
  // Keeps the id format the source had before it moved to the registry, so
  // stored items are not duplicated: the item id is this prefix + the key.
  idPrefix?: string;
};

// Parser registry. Changing what any entry's parser or selection rules
// return means bumping VALIDATOR_REVISION in validators.ts, or a stored
// validator keeps answering 304 and the new code never sees the page.
const CONFIGS: Record<string, Omit<OfficialSourceConfig, "id" | "publisher" | "name">> = {
  anthropic: {
    url: "https://www.anthropic.com/news",
    format: "anthropic-news",
    class: "news",
    hostAllowlist: ["www.anthropic.com"],
    idPrefix: "anthropic:/news/",
  },
  "claude-platform-release-notes": {
    product: "Claude Platform",
    url: "https://platform.claude.com/docs/en/release-notes/feed.xml",
    format: "rss",
    class: "changelog",
    defaultKind: "api-change",
    hostAllowlist: ["platform.claude.com"],
  },
  "claude-apps-release-notes": {
    product: "Claude apps",
    url: "https://support.claude.com/en/articles/12138966-release-notes",
    format: "intercom-html",
    class: "changelog",
    hostAllowlist: ["support.claude.com"],
  },
  "claude-articles": {
    product: "Claude",
    url: "https://claude.com/resources/articles/rss.xml",
    format: "rss",
    class: "news",
    hostAllowlist: ["claude.com"],
  },
  "openai-news": {
    url: "https://openai.com/news/rss.xml",
    format: "rss",
    class: "news",
    allowCategories: ["Product", "Company", "Research", "Engineering", ""],
    excludeUrlParts: ["/business/"],
    hostAllowlist: ["openai.com"],
    idPrefix: "rss:https://openai.com/news/rss.xml:",
  },
  "codex-changelog": {
    product: "Codex",
    url: "https://developers.openai.com/codex/changelog/rss.xml",
    format: "rss",
    class: "changelog",
    kindRules: [{ titlePattern: "^Codex CLI Release:", kind: "tool-release" }],
    // The feed redirects to learn.chatgpt.com and its entry URLs live there.
    hostAllowlist: ["developers.openai.com", "learn.chatgpt.com"],
  },
  "chatgpt-release-notes": {
    product: "ChatGPT",
    url: "https://help.openai.com/en/articles/6825453-chatgpt-release-notes",
    format: "intercom-html",
    class: "changelog",
    hostAllowlist: ["help.openai.com"],
    sequentialGroup: "help.openai.com",
  },
  "openai-model-release-notes": {
    product: "OpenAI models",
    url: "https://help.openai.com/en/articles/9624314-model-release-notes",
    format: "intercom-html",
    class: "changelog",
    hostAllowlist: ["help.openai.com"],
    sequentialGroup: "help.openai.com",
  },
  "openai-api-changelog": {
    product: "OpenAI API",
    url: "https://developers.openai.com/api/docs/changelog.md",
    pageUrl: "https://developers.openai.com/api/docs/changelog",
    format: "md-openai-changelog",
    class: "changelog",
    hostAllowlist: ["developers.openai.com"],
  },
  "google-developers-blog": {
    product: "Gemini",
    url: "https://blog.google/technology/developers/rss/",
    format: "rss",
    class: "news",
    hostAllowlist: ["blog.google"],
  },
  "google-deepmind-blog": {
    url: "https://deepmind.google/blog/rss.xml",
    format: "rss",
    class: "news",
    hostAllowlist: ["deepmind.google"],
  },
  "gemini-api-changelog": {
    product: "Gemini API",
    url: "https://aistudio.google.com/docs/changelog.md",
    pageUrl: "https://aistudio.google.com/docs/changelog",
    format: "md-dated",
    class: "changelog",
    hostAllowlist: ["aistudio.google.com"],
  },
  "xai-release-notes": {
    product: "xAI API",
    url: "https://docs.x.ai/developers/release-notes.md",
    pageUrl: "https://docs.x.ai/developers/release-notes",
    format: "md-month",
    class: "changelog",
    hostAllowlist: ["docs.x.ai"],
  },
  "xai-news": {
    url: "https://x.ai/news",
    sitemapUrl: "https://x.ai/sitemap.xml",
    format: "xai-news",
    class: "news",
    hostAllowlist: ["x.ai"],
  },
};

export const OFFICIAL_SOURCES: OfficialSourceConfig[] = OFFICIAL_SOURCES_REGISTRY.map((entry) => {
  const config = CONFIGS[entry.id];
  if (!config || !entry.publisher) throw new Error(`No fetch config for official source "${entry.id}"`);
  if (Boolean(entry.changelog) !== (config.class === "changelog")) {
    throw new Error(`Official source "${entry.id}": registry changelog flag and config class disagree`);
  }
  return { id: entry.id, publisher: entry.publisher, name: entry.name, ...config };
});

// How Groq's answer may change an item's official info: the class of its
// source (official GitHub repos are release notes), and whether the source
// fixes the kind (a defaultKind, or a versioned tool release).
export function officialMergeContext(item: Pick<FeedItem, "sourceId" | "official">): MergeContext {
  const config = OFFICIAL_SOURCES.find((source) => source.id === item.sourceId);
  return {
    sourceClass: config?.class ?? "changelog",
    fixedKind: item.official?.kind === "tool-release" || Boolean(config?.defaultKind),
  };
}

// Watched repos whose releases are official. Their items get official info
// and their toggle is the same repo-releases sourceId as any watched repo.
export const OFFICIAL_REPOS: Record<string, { publisher: PublisherId; product: string }> = {
  "anthropics/claude-code": { publisher: "anthropic", product: "Claude Code" },
  "google-gemini/gemini-cli": { publisher: "google", product: "Gemini CLI" },
};
