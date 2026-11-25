// Edit these lists to customize what shows up in your feed.

export const RSS_FEEDS: { name: string; url: string }[] = [
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
  // The `vibecoding` tag (coding with AI/LLM tools) rather than the whole
  // site: the general feed was almost entirely off-topic in triage.
  { name: "Lobsters", url: "https://lobste.rs/t/vibecoding.rss" },
  { name: "Ars Technica", url: "https://arstechnica.com/feed/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "GitHub Blog", url: "https://github.blog/feed/" },
  { name: "Pragmatic Engineer", url: "https://newsletter.pragmaticengineer.com/feed" },
  { name: "Stack Overflow Blog", url: "https://stackoverflow.blog/feed/" },
];

// Vendor release notes, changelogs and news (Anthropic, OpenAI, Google, ...)
// are not listed here: they live in the official source registry
// (sourceRegistry.ts for names/publishers, official/sources.ts for how each
// one is fetched).

// GitHub repos to watch for new releases (AI dev tools).
export const WATCHED_REPOS: string[] = [
  "anthropics/claude-code",
  "google-gemini/gemini-cli",
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
// GitHub Trending is fetched from a larger pool, then narrowed to AI-related
// repos before applying the limit above.
export const GITHUB_TRENDING_POOL_SIZE = 100;
export const DEFAULT_RELEASES_PER_REPO = 2;
// Official sources (vendor changelogs/news): newest entries per source, cut
// by publish date at fetch time so a feed that still lists years of history
// cannot flood the store.
export const DEFAULT_OFFICIAL_ITEM_LIMIT = 6;
export const DEFAULT_OFFICIAL_LOOKBACK_DAYS = 14;

// Default rolling retention window (days) for the persistent item store —
// also overridable via the settings page.
export const DEFAULT_RETENTION_DAYS = 3;
// Official updates are low-volume and stay useful for weeks (a deprecation
// announced today with a January date), so they live longer than the rest.
export const DEFAULT_OFFICIAL_RETENTION_DAYS = 30;

// Official fetches: timeout for headers + body, and the largest body read.
export const OFFICIAL_FETCH_TIMEOUT_MS = 15_000;
export const OFFICIAL_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
// Largest article body kept per official item (Codex CLI release notes reach 80 KB).
export const OFFICIAL_MAX_BODY_CHARS = 24_000;

// How long on-demand article extractions are cached in-memory (ms).
export const EXTRACT_CACHE_TTL_MS = 60 * 60 * 1000;

// Per-request timeout for og:image scraping and article extraction (ms).
export const FETCH_TIMEOUT_MS = 5000;

// Topics for filtering + AI classification. An item with no topic counts
// as off-topic and is hidden from the default feed.
//
// Keyword matching is the instant, free first pass, applied only until Groq
// has analysed the item; once it has, Groq's topics replace the keyword ones
// (keywords are too blunt to be trusted over a real classification).
// Keywords match on word boundaries; a trailing "*" makes one a prefix
// ("agent*" matches agent, agents, agentic). A keyword topic is only
// assigned when the text also has AI context (AI_CONTEXT_TERMS), so
// "Windows update" or "real estate agent" never match.
//
// `description` is what Groq sees when classifying.
export const TOPICS: { id: string; label: string; description: string; keywords: string[] }[] = [
  {
    id: "ai-workflow",
    label: "How devs work with AI",
    description:
      "how developers work with AI agents and coding assistants: workflows, practices, prompting, " +
      "spec-driven development, context/harness engineering, reviewing AI-written code, managing agents",
    keywords: [
      "workflow*", "pair programming", "vibe coding", "vibecoding", "prompt", "prompts", "prompting",
      "spec driven", "context engineering", "harness engineering", "agentic engineering",
    ],
  },
  {
    id: "ai-tools",
    label: "AI tools & agents",
    description:
      "AI developer tools: coding agents, assistants, agent harnesses, MCP servers, skills, plugins, " +
      "SDKs and open-source repos developers can use",
    keywords: [
      "agent*", "copilot", "claude code", "cursor", "codex", "harness*", "mcp", "coding assistant*",
      "plugin*", "skills",
    ],
  },
  {
    id: "ai-updates",
    label: "AI tool updates",
    description:
      "releases, launches and changes of AI models and AI developer tools (new versions, features, " +
      "pricing or API limit changes)",
    keywords: ["release*", "changelog", "launch*", "announc*", "introducing", "now available"],
  },
  {
    id: "career",
    label: "Career & industry",
    description:
      "how AI changes developer careers: rising or fading skills and roles, hiring, interviews, " +
      "salaries, layoffs, the job market",
    keywords: [
      "career*", "hiring", "interview*", "salary", "salaries", "layoff*", "job market",
      "forward deployed",
    ],
  },
  {
    id: "ai-industry",
    label: "AI industry",
    description:
      "big AI industry events only: major labs and their models, large funding/acquisitions, key " +
      "executives joining or leaving, AI chips, GPUs and data centers. Not policy/regulation, not " +
      "small company news",
    keywords: ["nvidia", "gpu*", "data center*", "datacenter*", "acquir*", "acquisition*", "funding", "valuation"],
  },
];

// Text must contain at least one of these (word-bounded, "*" = prefix) for
// keyword topics to apply at all. Deliberately excludes ambiguous words like
// "agent" or "cursor" on their own.
export const AI_CONTEXT_TERMS: string[] = [
  "ai", "llm*", "gpt*", "genai", "claude", "anthropic", "openai", "chatgpt", "codex", "gemini",
  "deepseek", "mistral", "llama", "qwen", "copilot", "agentic", "ai agent*", "coding agent*",
  "agent skill*", "mcp", "model context protocol", "language model*", "machine learning", "vibe coding",
  "vibecoding", "rag", "embedding*", "inference", "fine tun*",
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

// Circuit breaker for the daily cap. A 429 whose retry-after is at least this
// long (seconds) is a daily limit, not the per-minute one (whose retry-after is
// a few seconds): Groq is then not called again until it has passed.
export const GROQ_COOLDOWN_MIN_RETRY_AFTER_SECONDS = 120;
// Never pause for longer than this, whatever the header says.
export const GROQ_COOLDOWN_MAX_SECONDS = 24 * 60 * 60;
// Pause until the next UTC midnight once today's own counters come within this
// much of a daily limit, before Groq has to answer with a 429.
export const GROQ_BUDGET_RESERVE = { requests: 5, tokens: 2_000 };

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
  // Official sources: stuck after this many failed or empty runs in a row;
  // red once this share of them is stuck.
  officialStreak: 3,
  officialStuckShare: 0.5,
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

// Article bodies up to this many chars are translated in one Groq call.
// Longer ones are split at block boundaries into chunks of at most this
// size and translated chunk by chunk (see lib/translate.ts).
export const TRANSLATE_MAX_CHARS = 6000;

// How many untranslated chunks of a long article one page render may send
// to Groq. A chunk costs roughly 4,000 tokens (input + output) against the
// free tier's 8,000 tokens per minute, so two is the most that fits one
// render; the rest waits for the reader to ask for the next batch.
export const TRANSLATE_CHUNKS_PER_RUN = 2;

// How long one page render may spend translating (ms). The article route
// allows 60 s (maxDuration); extraction and rendering need the rest. Groq
// calls time out at this deadline and 429 retries only happen when they fit,
// so a rate-limited render ends with what it has instead of timing out.
export const TRANSLATE_RENDER_BUDGET_MS = 40_000;

// Output needs to cover a whole translated article rather than a short
// summary, and Vietnamese diacritics tokenize less efficiently than plain
// English, so this is sized well above a naive chars/4 estimate.
export const TRANSLATE_MAX_TOKENS = 4000;
