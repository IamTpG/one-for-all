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

// Groq limits for GROQ_MODEL on this account (Groq console > Limits). Used only
// to draw the dashboard's usage charts and meters — nothing enforces them;
// Groq itself rejects calls over the limit. Update if the account's limits change.
export const GROQ_LIMITS = {
  requestsPerMinute: 30,
  tokensPerMinute: 8_000,
  requestsPerDay: 1_000,
  tokensPerDay: 200_000,
};

// Upstash Redis free-plan limits (Upstash console > database > Details). Used
// only to draw the dashboard's usage meters — Upstash itself enforces them.
// The console shows the storage limit as "238.42 MB", which is 250,000,000
// bytes; the bandwidth limit is shown as "10 GB" (taken here as 10 GiB).
export const UPSTASH_LIMITS = {
  dataSizeBytes: 250_000_000,
  bandwidthBytesPerMonth: 10 * 1024 ** 3,
  commandsPerSecond: 10_000,
};

// How long per-minute Groq usage buckets are kept (the dashboard charts at
// most the last 24h, so a day or two of slack is plenty).
export const GROQ_USAGE_RETENTION_DAYS = 3;

// How often the Cloudflare cron Worker pings /api/cron/tick — keep in sync
// with `triggers.crons` in cloudflare/cron-worker/wrangler.jsonc. Only used
// by the dashboard to work out how many ticks to expect so far today.
export const CRON_TICK_INTERVAL_MINUTES = 10;

// How many recent ticks the dashboard keeps, and how long the per-day tick
// counter hash lives.
export const DASHBOARD_TICK_HISTORY_LIMIT = 50;
export const DASHBOARD_TICK_COUNT_RETENTION_DAYS = 3;
// Per-day tick totals kept for the cron-health heatmap (one hash, one field per UTC day).
export const DASHBOARD_TICK_DAILY_RETENTION_DAYS = 90;
// Weeks shown by the Activity heatmaps.
export const DASHBOARD_HEATMAP_WEEKS = 12;

// When the dashboard's status banner turns amber ("warn") or red ("bad").
// Percentages are of a limit; minutes/ms are ages or durations.
export const DASHBOARD_THRESHOLDS = {
  // Age of the newest cron tick (the cron fires every CRON_TICK_INTERVAL_MINUTES).
  tickAgeMinutes: { warn: 25, bad: 60 },
  // How long a due fetch slot may go without a recorded run.
  fetchOverdueMinutes: { warn: 30, bad: 180 },
  // Items waiting for translation, ignored for a while right after a fetch
  // (a fresh fetch is expected to leave a queue that drains over a few ticks).
  backlogItems: { warn: 50, bad: 150 },
  backlogGraceMinutesAfterFetch: 120,
  // Share of the last fetch's sources that failed (any failure warns).
  sourcesFailedShare: { bad: 0.5 },
  groqTokensPercent: { warn: 70, bad: 90 },
  upstashBandwidthPercent: { warn: 70, bad: 90 },
  // Longest of the recent ticks, against the 60s function limit.
  tickDurationMs: { warn: 40_000, bad: 55_000 },
};

// How many entries the owner dashboard's capped history lists keep. Small
// on purpose — this is "is everything working right now," not analytics.
export const DASHBOARD_RUN_HISTORY_LIMIT = 30;
export const DASHBOARD_BACKFILL_HISTORY_LIMIT = 50;
export const DASHBOARD_GROQ_FAILURE_LIMIT = 50;
export const DASHBOARD_RECENT_FAILURES_DISPLAY_LIMIT = 20;
export const DASHBOARD_VIEWS_CHART_DAYS = 14;

// Article bodies are capped before translation — very long articles only
// get their first portion translated rather than chunked and reassembled.
export const TRANSLATE_MAX_CHARS = 6000;

// Output needs to cover a whole translated article rather than a short
// summary, and Vietnamese diacritics tokenize less efficiently than plain
// English, so this is sized well above a naive chars/4 estimate.
export const TRANSLATE_MAX_TOKENS = 4000;
