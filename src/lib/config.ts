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
