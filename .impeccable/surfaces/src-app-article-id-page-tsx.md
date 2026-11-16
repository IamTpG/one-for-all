---
version: 1
slug: "src-app-article-id-page-tsx"
primary_target: "src/app/article/[id]/page.tsx"
related_targets: ["src/app/article/[id]/loading.tsx","src/app/article/[id]/not-found.tsx","src/lib/translate.ts"]
---

# Article page

## Scope and mode

- **Surface:** the article page (`/article/[id]`) with its `loading.tsx` and `not-found.tsx`. Second surface of the redesign after the home feed.
- **Mode:** Read. The visitor already decided "read" or "act" on the feed (about 17% of items, per triage) and comes here for the full Vietnamese body, then the original, the repo or the discussion.
- **Fidelity:** production-ready, wired to the real store, extraction and translation.

## Visual authority

"Chữ lớn · Chanh" exactly as DESIGN.md records it; direction is not reopened. The page leaves the frosted-glass tokens, Lexend / Plex Mono and `PageHeader`. The world's tokens move out of `Feed.module.css` into a shared module both surfaces compose. No lime field on this page (zero is within the One Lime Field Rule); lime only as selection and dark focus.

## What moved here from feed cards

Images and video embeds, HN points / GitHub stars, and the link to the original (plus the HN discussion thread).

## Order

1. Top bar like the feed: `‹ OneForAll` back (keeps feed scroll), VI/EN pill, theme ink button.
2. Title h1 at the text-only headline scale. No kicker.
3. Standfirst: the Vietnamese summary, larger than body, graphite. No "AI Summary" badge.
4. Metadata line: Topic · Source · date · reading time (from content length) · HN points or stars; HN gets a discussion link.
5. Action pills: Save / Saved (feed's `toggleSaved`) and Read the original ↗ (repo / release on GitHub where apt).
6. Media wider than the text column: video 16:9 or image (6px, invisible until loaded, rejected under 640px wide).
7. Body prose (~68ch): Mona Sans headings with negative tracking, ink underlined links, system mono for code only, 6px images, hairlines.
8. End: hairline, source attribution, original + save again.

## Translation

- Body streams through Suspense: title, standfirst and meta paint at once; the body slot says it is translating.
- Articles up to 6,000 chars translate in one call (existing cache key stays valid). Longer ones split at block boundaries into ≤6,000-char chunks, each cached by content hash. One render translates at most a small batch of missing chunks (Groq free tier: 8k TPM); untranslated chunks render in English below a clear marker with a "translate the rest" action that runs the next batch.
- Failure or Groq off: English body with a small note. EN toggle shows the original body.

## States

Translating; translated; partially translated (next batch pending); translation failed; content missing (standfirst stays, note, one ink pill to the original); release with no notes; trending repo (README from the GitHub API, stars, open repo); video item; not found (saved snapshot in this browser still offers title, summary and original; else back to feed).

## Feed state

Opening marks the item seen. Time on the article counts as activity in the current visit (shared activity tracking moves into `feedState.ts`), so a long read doesn't reset the feed's "new" marks. Save / unsave shares the feed's saved store.

## Decisions (2026-11-16)

- Long articles: chunked translation, only when over 6,000 chars, batch-limited per render; a long article may finish over several batches.
- GitHub Trending items open this page instead of going straight to GitHub.

## Layout decision (2026-11-16, surface round seed:449b07d3a230d038)

The user compared seven article-page layouts inside the locked world and combined two: the **ink masthead** (sketch `surface-ink`) on top and the **sticky table of contents on the left** (sketch `surface-toc`).

- Masthead: full-bleed ink block (dark theme: Deep Olive Band #1d2309) holding the top bar, title, standfirst, metadata line, actions and a row of lime width-125 numerals: reading minutes and section count. HN points / stars stay in the small metadata line (triage: never a decision reason), not in the big numerals.
- Below: a 240px sticky table of contents built from the body's h2 headings (shown at 3+ headings), current section bold with a 2px ink bar, "Còn N phút" under it; the 680px reading column to its right with media at its top. Under 1100px the contents become a "Trong bài này" disclosure above the body.
- No lime field: lime appears only as the masthead numerals, focus and selection.
