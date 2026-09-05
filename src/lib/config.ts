// Edit these lists to customize what shows up in your feed.

export const RSS_FEEDS: { name: string; url: string }[] = [
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
  { name: "Lobsters", url: "https://lobste.rs/rss" },
  { name: "Ars Technica", url: "https://arstechnica.com/feed/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "GitHub Blog", url: "https://github.blog/feed/" },
  { name: "Pragmatic Engineer", url: "https://newsletter.pragmaticengineer.com/feed" },
  { name: "Stack Overflow Blog", url: "https://stackoverflow.blog/feed/" },
  { name: "OpenAI News", url: "https://openai.com/news/rss.xml" },
];

// Blog-like sources with no RSS/Atom/JSON feed available, fetched by a
// dedicated scraper in src/lib/fetchers instead of the generic RSS fetcher.
// Listed here just so they show up alongside RSS_FEEDS in the UI (sidebar
// nav, settings toggles).
export const CUSTOM_BLOG_SOURCES: { name: string; sourceId: string }[] = [
  { name: "Anthropic", sourceId: "anthropic" },
];

// GitHub repos to watch for new releases (AI dev tools).
export const WATCHED_REPOS: string[] = [
  "anthropics/claude-code",
  "continuedev/continue",
  "block/goose",
  "All-Hands-AI/OpenHands",
  "Aider-AI/aider",
];

// Defaults for the per-source item limits — overridable per-owner via the
// settings page (see siteSettings.ts); these are just the fallback values.
export const DEFAULT_RSS_ITEM_LIMIT = 20;
export const DEFAULT_HN_ITEM_LIMIT = 25;
export const DEFAULT_GITHUB_TRENDING_LIMIT = 10;
export const DEFAULT_RELEASES_PER_REPO = 2;
export const DEFAULT_ANTHROPIC_ITEM_LIMIT = 15;

// Default rolling retention window (days) for the persistent item store —
// also overridable via the settings page.
export const DEFAULT_RETENTION_DAYS = 3;

// How long on-demand article extractions are cached in-memory (ms).
export const EXTRACT_CACHE_TTL_MS = 60 * 60 * 1000;

// Per-request timeout for og:image scraping and article extraction (ms).
export const FETCH_TIMEOUT_MS = 5000;

// Topics for filtering + AI classification. Keyword matching always runs
// (free); Groq's classification (if configured) adds to these, it never
// replaces them.
export const TOPICS: { id: string; label: string; keywords: string[] }[] = [
  {
    id: "ai-workflow",
    label: "How devs work with AI",
    keywords: ["workflow", "pair program", "vibe coding", "prompt", "spec-driven"],
  },
  {
    id: "ai-tools",
    label: "AI tools & agents",
    keywords: ["agent", "copilot", "claude code", "cursor", "harness", "mcp", "coding assistant"],
  },
  {
    id: "ai-updates",
    label: "AI tool updates",
    keywords: ["release", "changelog", "launch", "announc", "update", "v1.", "v2."],
  },
  {
    id: "career",
    label: "Career & industry",
    keywords: ["career", "hiring", "interview", "promotion", "salary", "layoff", "roadmap", "job market"],
  },
];

// Set GROQ_API_KEY (and REDIS_URL) in .env.local to enable AI summaries and
// classification. Without both, the feed falls back to source-provided
// summaries and keyword-only topics — no error, just less precise.
export const GROQ_MODEL = "openai/gpt-oss-120b";

// How many not-yet-analyzed items get sent to Groq per backfill tick, and
// how many of those run concurrently. Each call costs up to ~1,500 tokens
// worst case (input + output), and Groq's free tier caps at 8,000 TPM — a
// burst of 8 (~12,000 tokens worst case) already sits above that ceiling,
// which is fine, since it's absorbed by requestCompletion's single retry
// with backoff, but going higher would make hitting that retry path (and
// the item just waiting for the next tick) more frequent, not less.
export const AI_BACKFILL_BATCH_SIZE = 8;
export const AI_CONCURRENCY = 2;

// How long an item's AI-generated summary/topics stay cached in Redis (s).
export const AI_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;

// How many entries the owner dashboard's capped history lists keep. Small
// on purpose — this is "is everything working right now," not analytics.
export const DASHBOARD_RUN_HISTORY_LIMIT = 30;
export const DASHBOARD_BACKFILL_HISTORY_LIMIT = 50;
export const DASHBOARD_GROQ_FAILURE_LIMIT = 50;
export const DASHBOARD_RECENT_FAILURES_DISPLAY_LIMIT = 20;

// Article bodies are capped before translation — very long articles only
// get their first portion translated rather than chunked and reassembled.
export const TRANSLATE_MAX_CHARS = 6000;

// Output needs to cover a whole translated article rather than a short
// summary, and Vietnamese diacritics tokenize less efficiently than plain
// English, so this is sized well above a naive chars/4 estimate.
export const TRANSLATE_MAX_TOKENS = 4000;
