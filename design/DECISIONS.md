# Design decisions

## Layout
Facebook/Twitter-style single scrolling feed, chosen over a reader-pane
(Feedly-style) or masonry grid. Centered column, ~640px.

## Typography
- **Be Vietnam Pro** — headlines, UI labels. Chosen specifically for full
  Vietnamese diacritic support, ahead of the planned translate feature.
- **Noto Sans** — body/summary copy, same reasoning for translated long-form text.
- **IBM Plex Mono** — metadata (timestamps, source tags, star/point counts),
  tabular-nums for aligned stats.

## Color
Slate-blue neutrals with a single warm amber accent, used only for
interactive/active states and the unread indicator:
- Light: bg `#f5f6f8`, text `#12161c`, accent `#c8720a`
- Dark: bg `#10131a`, text `#e7e9ee`, accent `#e2a93b`

## Content pipeline (implemented)
- **RSS/blogs**: `content:encoded` full HTML used directly when a feed
  provides it (sanitized, stored as `fullContentHtml`). Otherwise "Read
  more" calls `/api/extract`, which runs Mozilla's Readability
  (`@mozilla/readability` + `jsdom`) against the article URL, lazily and
  cached for an hour.
- **Hacker News**: same lazy Readability extraction against the linked
  external article (HN itself has no content).
- **GitHub releases**: release body markdown rendered with `marked`, then
  sanitized — no extraction needed. Trending repos are out of scope
  (description text is enough for now).
- **Images**: pulled from the item's own content first (free), falling
  back to an og:image scrape only when needed — done eagerly during the
  10-minute feed refresh, not on click, since cards need a thumbnail
  immediately.
- **Video**: YouTube links detected and resolved via the official
  `/oembed` endpoint, not scraping.
- **Known limitation**: a few sites (e.g. Ars Technica) return a
  bot-challenge response to server-side fetches, so extraction fails for
  them — the UI falls back to "Couldn't load the full article, open the
  original" rather than breaking. Not worth defeating deliberately; this
  is a personal reader, not a scraper that needs to get past protections.

## Light/dark toggle
Manual sun/moon button in the top bar, overrides OS theme, choice persisted
in `localStorage`. Defaults to OS preference on first visit.

## Sidebars (≥980px viewport width)
- **Left**: source navigation — category filters (All/Blogs/HN/Trending/Releases)
  plus individual feed shortcuts (Simon Willison, The Pragmatic Engineer,
  Latent Space). Same filtering mechanism as the top pill bar.
- **Right**: "Trending repos" / "Top on HN" widget, condensed top-5 lists.
  Clicking a row opens the real external page in a new tab (same behavior as
  the "Open" link on full cards) — it's a shortcut past scrolling, not a
  second in-app reading surface.
- Center column is flexible (not a fixed 640px) so the layout degrades
  gracefully at high browser zoom instead of hiding sidebars abruptly.
