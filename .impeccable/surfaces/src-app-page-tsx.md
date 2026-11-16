---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/AppShell.tsx","src/app/Card.tsx","src/app/SidebarLeft.tsx","src/app/SidebarRight.tsx"]
---

# Home feed

## Scope and mode

- **Surface:** the home feed (`/`): header, filters, the item stream and the side column. It is the first surface of a full redesign. The old look is evidence, not authority. The article page, settings, dashboard and owner login follow later in the new world.
- **Mode:** Operate with Read moments. The visitor scans many items fast and decides skip / skim / read / act. Precision and scan speed come before expression.
- **Fidelity:** production-ready, wired to the real store (`getStoredItems`) and real data.

## Audience and job

The owner and a few developer friends, visiting the public site once a day or every few days, on phone and desktop about equally. Job: catch up on what matters in AI-assisted development since the last visit, decide fast, and open only what deserves it.

## Evidence (triage, 105 real items; details in `triage-findings.md`)

- 83% of items are decided from the card alone. Skim is the dominant action (54%), read 13%, act 4%.
- Title and summary drive almost every decision. Followed products/companies are the next strongest signal.
- HN points / GitHub stars were never a reason and did not predict decisions. Images mattered once, source reputation twice, sharing never.
- Workflow and career items have the highest read rates. Industry items are "good to know".

## Remove from the feed

- HN points and GitHub stars on cards. They may still sort or rank behind the scenes, or appear on the article page.
- The right column's GitHub Trending / Top on HN widgets (popularity lists duplicating the feed).
- Large images, video embeds and the image lightbox on cards. Media stays on the article page.
- The "AI Summary" badge.
- Duplicate actions: one primary action (open the article page) plus one secondary link to the original, not "Read more" + "Open".
- The per-feed list in the main sidebar. Source filtering moves into a secondary filter menu.
- The owner-login lock icon for visitors. `/owner-login` stays reachable by URL; owners still get dashboard/settings entry points.
- Item count + live dot in the header, replaced by the "since last visit" signal.

## Keep

- Filters by topic, including the Off-topic bucket, and by source type.
- The language toggle, **defaulting to Vietnamese** (technical terms stay English; English original available). Today's code defaults to English, so the default must change.
- The light/dark theme toggle.
- Infinite loading, scroll-position restore on back navigation, and stable item order when data refreshes.
- Title → article page (the Vietnamese reading experience is core to the product).

## Add now (data exists)

1. **Since your last visit:** remember the last visit time in the browser. New items are marked, and the top of the feed summarises what is new and important since then.
2. **Seen state:** items the visitor opened are visually de-emphasised (browser storage).
3. **Save for later:** a save action on cards plus a way to view saved items (browser storage for now, account sync later).
4. **Releases grouped by repo:** e.g. "Claude Code: 2 new releases, v2.1.323 → v2.1.325", expandable.
5. **Compact AI-industry strip:** `ai-industry` items as one-liners in their own compact area, never mixed into the main stream at equal weight. This likely occupies the space the right column used.

## Design slots for data that comes later (pipeline work)

Design the card and layout so these drop in without a redesign. Render nothing when the data is absent; no placeholders shown to users.

6. Entity chips (Claude, OpenAI, Nvidia…).
7. Content type: tool/repo, release, workflow, career, industry, case study.
8. Merged coverage: one card per event with "N sources".
9. Length for video and long reads ("video 1h40", "12 min read").
10. Longer retention for important items (affects how "since last visit" behaves after long gaps).

## Card content (priority order)

1. Title (Vietnamese by default).
2. Summary, 1–2 sentences: the most important element. Items whose source content could not be fetched must not show a meaningless summary.
3. Entity chips and content type (when available).
4. Source + time, small and secondary.
5. "N sources" when merged; length for video and long reads.
6. Actions: open, save, original link.

## States and ranges

- Feed of roughly 50–250 on-topic items over the retention window. Releases arrive in bursts per repo. Industry items are few per day.
- Titles range from 3 words ("Qwen4-Max") to long HN titles. Summaries are 1–3 sentences, in Vietnamese and English. The Vietnamese translation may not be ready yet; it then falls back to English with a short note.
- States: first visit (no last-visit time), returning with nothing new, returning after several days with many new items, empty filter, store never fetched, translation pending, saved list empty.

## Constraints

- Next.js 16 app router, CSS Modules, existing data layer (`FeedItem`, `src/lib/store.ts`, `src/lib/keywordTopics.ts` with `isOnTopic` / `OFF_TOPIC`). No new paid services. Free-tier budgets (Vercel Hobby, Upstash, Groq).
- Equal phone and desktop use: the phone is a first-class layout, not a collapsed desktop.
- Accessibility: keyboard reachable filters and actions, visible focus, sufficient contrast in both themes.

## Open decisions (not for the builder to invent)

- The visual world (palette, type, component language): decided in the redesign direction round.
- Where saved items live (filter vs. dedicated view): decide during the direction round.
