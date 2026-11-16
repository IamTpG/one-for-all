# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the owner**, a developer who works with AI coding agents daily. Opens OneForAll once or twice a day, sometimes only every few days, to catch up on what is new. Reads on desktop and phone about equally: skims on the phone, reads in depth or tries tools on the desktop.
- **Secondary: a small circle of developer friends** who visit the public site on their own and read it the same way the owner does, without owner rights (no settings, no fetch controls, no dashboard).

The job for both: *don't miss what matters in AI-assisted development*, and understand it fast enough to decide whether to skip, skim, read, or act on it.

## Product Purpose

OneForAll collects news from many sources, filters it down to what concerns developers working with AI, and presents it so a reader can catch up quickly. Three kinds of news matter most:

1. **New tools**: new repos, skills, plugins, MCP servers, agent harnesses and dev tools, plus releases of the tools already in use.
2. **New ways of working**: how people manage and collaborate with agents, and new workflows and practices.
3. **Career shifts**: which skills and roles are rising or fading (e.g. prompt engineering → spec-driven development → harness engineering, forward deployed engineer).

A fourth, **secondary** kind is **AI industry news**, kept only when the event is big enough to matter industry-wide:

- **Models and major labs**: new models, API pricing or limit changes, and moves by OpenAI, Anthropic, Google, Meta and similar labs.
- **Business and people**: big funding rounds, acquisitions, departures of key figures (e.g. a CEO leaving), industry layoffs.
- **Infrastructure and chips**: NVIDIA, GPUs, data centers, energy, compute cost.

Policy and legal news (regulation, export controls, lawsuits) is not a kept category.

Industry news is "good to know": the reader only needs to know an event happened. It stays compact and apart from the main AI-dev stream, and never takes space from tools, practices or career news.

Success means a reader returning after one to several days learns what was important since their last visit without scrolling through everything. The full chronological feed stays available for when they have time. Important items must not disappear just because the reader was away.

## Positioning

Instead of opening HN, X, Reddit, blogs, GitHub and newsletters separately, the reader gets one place that:

- keeps AI-dev material, adds only the big AI-industry events, and drops general tech news;
- merges blogs, Hacker News, GitHub Trending and tool releases into one stream;
- explains each item briefly in Vietnamese, so the gist is clear without opening the source;
- makes the drift of the craft visible over time: which concepts and roles are gaining or losing attention.

## Operating Context

- Visits are periodic catch-ups, not continuous monitoring. Fetching runs three times a day (default 08:30, 12:30, 20:30 Vietnam time), triggered by a Cloudflare Worker cron hitting `/api/cron/tick`.
- Phone sessions are short skims. Desktop sessions include opening the original article, a repo, or a release changelog, and trying a tool right away.
- The owner manages sources, fetch times, retention and watched repos from the settings page and monitors pipeline health and usage on the owner dashboard. Visitors never see these.

## Capabilities and Constraints

- **Sources:** RSS feeds (Simon Willison, Lobsters, Ars Technica, The Verge, GitHub Blog, Pragmatic Engineer, Stack Overflow Blog, OpenAI News), the Anthropic news page (scraped), Hacker News top stories, GitHub Trending (repos created in the last 7 days), and releases of watched repos (`src/lib/config.ts`, overridable in settings).
- **Item data today:** title, source, source type, publish time, summary (the source's own or AI-generated), Vietnamese title/summary, topics, HN points or GitHub stars, optional image/video, and extracted full content for the article page.
- **Topics:** `ai-workflow`, `ai-tools`, `ai-updates`, `career`. Keyword matching plus Groq classification. Keyword matching has known false positives, so topic labels are not yet fully trustworthy. There is no topic for AI industry news yet, and nothing yet judges whether an industry event is "big" (e.g. coverage by several sources).
- **Not yet available:** content type (release / tool / research / opinion / discussion), a "why it matters" line, merging duplicate coverage across sources, entity tagging (product / company), read/saved state, and a "since your last visit" view.
- **Retention:** 3 days by default. This conflicts with readers who return after several days; the important items must survive longer than the raw feed.
- **Language:** Vietnamese is the primary reading language. Tool names and technical terms (agent, harness, MCP, skill, spec-driven…) stay in English. The English original remains available. The code currently defaults to English with a Vietnamese toggle, and Vietnamese appears only once AI translation finishes.
- **Cost:** must run on free tiers (Vercel Hobby, Upstash Redis, Groq). A simple sign-in (e.g. GitHub) for friends is acceptable if it is needed, e.g. to sync read/saved state across devices. Without it, personal state lives in the visitor's browser.
- **Roles:** owner (cookie-based owner login) vs. anonymous visitor.

## Brand Commitments

- Product name: **OneForAll**.

## Evidence on Hand

- Live item store in Redis (`wire:items`) with real items from all sources.
- Item log export: `one-for-all-log-export-2026-10-11T17-44-12.csv`.
- Filter research notes comparing the current classifier with 5 other repos: `news-filter-research-notes.md`.
- Triage exercise, done 2026-11-16: the owner marked 82 real items. Findings are in `triage-findings.md` and the raw data in `.triage/decisions.json` (local only). Key facts:
  - 83% of items were decided from the card alone (skip or skim), and title + summary drove almost every decision.
  - HN points and GitHub stars were never a reason and did not predict decisions.
  - Followed products/companies were the strongest signal after title and summary.
  - Most skips were off-topic items the filter let through.
- No testimonials, user counts or metrics beyond the owner dashboard's own view counters. Do not invent any.

## Product Principles

1. **Catch-up first.** Design for the reader returning after a gap: what matters since the last visit comes before the full stream.
2. **Every field earns its place.** Show information only if it helps the reader decide skip / skim / read / act. When a signal is not trustworthy yet, show the reason in plain words instead of an unexplained score.
3. **Signal over volume.** Fewer, well-filtered items beat completeness; noise erodes trust in the filter. AI industry news passes only when it is a big event, and it stays secondary to AI-dev news.
4. **Vietnamese gist, English precision.** Explain in Vietnamese, keep the original terms and source one tap away.
5. **The craft over time.** Beyond individual items, help readers see which tools, practices and roles are rising or fading.
