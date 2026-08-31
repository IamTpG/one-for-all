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

export const HN_STORY_LIMIT = 15;
export const GITHUB_TRENDING_LIMIT = 10;
export const RELEASES_PER_REPO = 2;

// How long fetched results are cached in-memory before re-fetching (ms).
export const CACHE_TTL_MS = 10 * 60 * 1000;

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

// How many not-yet-analyzed items get sent to Groq per aggregation cycle,
// and how many of those run concurrently. Keeps well under Groq's free-tier
// 30 req/min limit and bounds how much a background refresh can cost.
export const AI_BATCH_LIMIT = 8;
export const AI_CONCURRENCY = 2;

// How long an item's AI-generated summary/topics stay cached in Redis (s).
export const AI_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;
