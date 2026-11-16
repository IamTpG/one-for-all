---
name: OneForAll
description: A Vietnamese-first AI-dev newsroom index where type is the interface and one lime band tells you what changed since your last visit.
colors:
  lime: "#d9f85a"
  ink: "#0b0b0b"
  ink-2: "#333333"
  ink-3: "#666666"
  paper: "#ffffff"
  rule: "#eaeaea"
  chip: "#f0f0f0"
  chip-hover: "#e4e4e4"
  band-ink-2: "#3a450c"
  tint: "#f6f9e4"
  tint-rule: "#e3eac2"
  image-ground: "#ededed"
  paper-dark: "#0e0f0b"
  ink-dark: "#f2f4ec"
  ink-2-dark: "#cdd0c4"
  ink-3-dark: "#9ea294"
  rule-dark: "#23261c"
  chip-dark: "#1b1d16"
  chip-hover-dark: "#272a20"
  olive-band-dark: "#1d2309"
  band-ink-2-dark: "#c4cf94"
  tint-dark: "#15190a"
  tint-rule-dark: "#2a3115"
  olive-ring-dark: "#3a4512"
typography:
  display:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(30px, 1.2rem + 2.6vw, 56px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  display-numeral:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
    fontVariation: "\"wdth\" 125"
  headline:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(24px, 1.1rem + 1.2vw, 32px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  headline-text-only:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(28px, 1.2rem + 1.8vw, 40px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(19px, 0.95rem + 0.6vw, 24px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  body-lead:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  nav:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  empty-title:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(22px, 1rem + 1vw, 28px)"
    fontWeight: 600
    letterSpacing: "-0.02em"
  label:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  label-small:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  count:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    fontFeature: "\"tnum\" 1"
  brand:
    fontFamily: "Mona Sans, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    letterSpacing: "-0.01em"
rounded:
  pill: "999px"
  image: "6px"
  panel: "12px"
spacing:
  gutter: "clamp(16px, 4.4vw, 64px)"
  chip-gap: "8px"
  row: "22px"
  lead: "28px"
  column: "32px"
  side-column: "clamp(48px, 5.5vw, 80px)"
  feed-end: "96px"
components:
  button-pill:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "34px"
  button-pill-hover:
    backgroundColor: "{colors.chip-hover}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    size: "34px"
  button-ink-large:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "40px"
  button-icon:
    textColor: "{colors.ink-3}"
    rounded: "{rounded.pill}"
    size: "36px"
  button-icon-hover:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.ink}"
  chip-group:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px 0 6px"
    height: "38px"
  chip-group-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.lime}"
  chip-entity:
    backgroundColor: "{colors.chip}"
    typography: "{typography.label-small}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  select-source:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 32px 0 14px"
    height: "34px"
  tab-topic:
    textColor: "{colors.ink-3}"
    padding: "15px 0 14px"
  tab-topic-active:
    textColor: "{colors.ink}"
  band-catch-up:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
  panel-industry:
    backgroundColor: "{colors.tint}"
    rounded: "{rounded.panel}"
    padding: "18px 22px 14px"
  image-lead:
    backgroundColor: "{colors.image-ground}"
    rounded: "{rounded.image}"
  image-thumb:
    rounded: "{rounded.image}"
    width: "168px"
---

# Design System: OneForAll

## Overview

**Creative North Star: "Chữ lớn · Chanh" (Big Type · Lime)**

OneForAll reads like a newsroom index where type is the interface. A white page and near-black ink carry everything; hierarchy comes from Mona Sans at different sizes and weights, set tight and large, never from boxes, cards or shadows. One saturated lime field, the catch-up band, sits under the top bar and states in a single sentence what changed since the reader's last visit, followed by group counts that act as filters. Below it, the stream is a column of big headlines with Vietnamese summaries separated by hairline rules.

Density is calm but fast: rows are open, measures are capped (summaries at 64ch), and secondary information (topic, source, time) sits in one small grey line under each item. Controls are pills; navigation is underline tabs. Images appear only when an item really has one, at a single 6px radius, and never as grey placeholders.

The dark theme is not an inversion of the lime: the band becomes deep olive, and lime moves to the leading numeral, the "new" dot and the focus ring, where a small amount reads as a signal instead of glare. The old frosted-glass look (blurred panels, gradient body, Lexend / Plus Jakarta Sans / IBM Plex Mono) is the retired system.

**Migration status.** Only the home feed (`/`) is built in this world; its tokens are scoped to the feed root. The article page, settings, dashboard and owner login still render the old frosted-glass tokens from `src/app/globals.css`, `AppShell.module.css` and `PageHeader`, and will move to this system. New and migrated surfaces follow this file, not the old tokens.

**Key Characteristics:**
- White paper, near-black ink, two text greys; one lime field per screen.
- Mona Sans only, with its width axis used for the numerals that matter.
- Big negative-tracked headlines (-0.02em to -0.035em) carry the hierarchy.
- Hairline rules between items; no cards, no shadows.
- Pill controls, underline tabs, 6px images, one 12px tinted panel.
- Vietnamese-first copy with technical terms kept in English.

## Colors

A black-and-white newsroom with a single acid-lime voice and an olive night mode.

### Primary
- **Chanh Lime** (#d9f85a): the catch-up band's full-bleed field in light mode. Also the ring around the "new" dot and the text-selection highlight. In dark mode it becomes the band's leading numeral, the group-count text when chips invert, the new dot itself and the focus ring.

### Neutral
- **Newsprint Ink** (#0b0b0b): all headlines, active tabs and views, the ink button, count pills on the band, the new dot (light), focus ring (light).
- **Graphite** (#333333): summaries and supporting body copy.
- **Slate Grey** (#666666): metadata lines, inactive tabs and views, tab counts, seen headlines, icon buttons at rest.
- **Paper** (#ffffff): page background and the sticky filter bar.
- **Hairline** (#eaeaea): row separators, the filter bar's bottom border, version-list rules.
- **Chip Grey** (#f0f0f0) and **Chip Grey Pressed** (#e4e4e4): pill-button, source-select and entity-chip fills and their hover.
- **Image Ground** (#ededed): the frame behind a loading lead image.
- **Band Olive Ink** (#3a450c): the band's second clause and its small notes, darker olive on lime.
- **Lime Tint** (#f6f9e4) with **Tint Rule** (#e3eac2): the industry panel's ground and its internal separators.

### Dark theme
- **Night Paper** (#0e0f0b), **Night Ink** (#f2f4ec), **Night Graphite** (#cdd0c4), **Night Slate** (#9ea294): warm-green-tinted counterparts of the four neutrals.
- **Night Hairline** (#23261c), **Night Chip** (#1b1d16), **Night Chip Pressed** (#272a20).
- **Deep Olive Band** (#1d2309): the band field; its second clause is **Pale Olive** (#c4cf94) and its chip borders are lime at 50% alpha.
- **Night Tint** (#15190a) with **Night Tint Rule** (#2a3115): the industry panel.
- **Olive Ring** (#3a4512): ring around the lime new-dot, and selection background.

### Named Rules
**The One Lime Field Rule.** Only the catch-up band is filled with lime. Elsewhere lime appears as a signal no larger than a dot ring, a numeral or a focus ring, or diluted to the 3% tint of the industry panel. A second lime surface on a screen breaks the world.

**The Two Greys Rule.** Text uses ink, graphite (#333) or slate (#666), nothing in between. Seen items step down to slate; they are not faded with opacity (images are the one exception, at 0.7).

**The Olive Night Rule.** In dark mode the lime field never stays lime. It turns deep olive and hands its lime to the numerals and the new dot.

## Typography

**Display Font:** Mona Sans (variable, `wdth` axis loaded; fallback Segoe UI, Roboto, sans-serif)
**Body Font:** Mona Sans
**Label/Mono Font:** none; counts use Mona Sans tabular numerals.

**Character:** One grotesque does everything. Big sizes get tight negative tracking and weight 600; the one figure that matters gets weight 800 stretched to 125% width. Both faces carry the `vietnamese` subset; diacritics must render cleanly at display size.

### Hierarchy
- **Display** (600, clamp(30px → 56px), 1.05, -0.035em, max 27ch, balanced): the catch-up sentence in the band. Only one per page.
- **Display Numeral** (800, `wdth` 125, tabular, -0.02em): the leading count inside the display sentence ("26 tin mới…").
- **Headline** (600, clamp(24px → 32px), 1.12, -0.025em, balanced): the lead story's title beside its image. Without an image it grows to clamp(28px → 40px) at max 26ch.
- **Title** (600, clamp(19px → 24px), 1.2, -0.02em, `text-wrap: pretty`): every stream row's headline. Seen rows drop to 500 in slate.
- **Body** (400, 16px, 1.55, max 64ch, clamped to 4 lines; lead summary 17px, 6 lines): Vietnamese summaries in graphite.
- **Label** (500, 14px): pill buttons, source select, group chips, metadata lines (400 in slate), disclosure buttons (600 in ink). View and tab labels are 15px, 600 when active.
- **Label Small** (500, 13px): entity chips, translation-pending notes, industry metadata.
- **Count** (600, 12px, tabular): view counts and tab counts; group counts on the band are 13px at `wdth` 112.
- **Brand** (700, 18px, -0.01em): the "OneForAll" wordmark in the top bar.

### Named Rules
**The Size-Not-Style Rule.** Hierarchy is size and weight in a single family. No second display face, no italics for emphasis, no all-caps labels.

**The Width-Axis Rule.** The `wdth` axis is reserved for counts the reader acts on: 125% for the band's leading number, 112% for group counts. Body text and headlines stay at normal width.

## Layout

A full-bleed top bar and band, then a centered container (max 1440px) with a fluid gutter of clamp(16px, 4.4vw, 64px).

- **Top bar** (min 64px): brand, the Mới · Tất cả · Đã lưu view switch, and right-aligned actions (VI/EN pill, theme ink button, owner-only circle buttons). Below 720px the view switch wraps to its own full-width row.
- **Catch-up band**: full width, padding clamp(22px → 36px) top and clamp(20px → 28px) bottom; group chips 8px apart after an 18–24px gap.
- **Filter bar**: sticky at top, 52px tall, paper background with a hairline bottom. Topic tabs scroll horizontally with a 56px fade-out mask below 1000px; the source select stays pinned right.
- **Stream**: single column, max 800px. Lead story pads 28px; rows pad 22px; both end in a hairline. At 720px+ the lead splits image / text (0.95fr / 1fr, 32px gap) and row thumbnails grow from 88px to 168px (4:3) with a 28px gap.
- **Side column** (1100px+, when industry items exist): 340px, gap clamp(48px → 80px), panel sticky at 76px. Below 1100px the industry panel renders inline in the stream instead.
- **No side column at 1100px+**: the stream widens to 1040px, thumbnails to 232px with a 40px gap, and the lead to 1.15fr / 1fr, so half the page is never left empty.
- **Feed end**: 96px bottom padding; infinite loading via a 1px sentinel.

Breakpoints actually used: 720px, 1000px, 1100px.

## Elevation & Depth

The system is flat. There are no box shadows on surfaces; depth comes from color fields (the band, the tinted panel) and hairline rules. The only `box-shadow` in the world is a 2.5px solid ring around the 8px "new" dot, used as an outline, not as elevation. The sticky filter bar separates from the stream by its hairline and opaque paper, not by a shadow.

### Named Rules
**The Hairline-Not-Shadow Rule.** Items are separated by 1px rules in `rule`; nothing floats. If a surface needs to stand apart, it gets a tint field, not a shadow.

## Shapes

Three radii and nothing else: full pills (999px) for every control, count and chip; 6px for images (lead figure and thumbnails); 12px for the one tinted panel. The new dot is a circle. Text blocks, the band and the filter bar are square-edged and full-bleed. Borders are 1px hairlines for structure and 1.5px ink outlines only on the band's group chips.

## Components

### Buttons
Quiet pills that never shout; the only filled-ink control is the theme toggle and the empty-state call to action.
- **Shape:** full pill (999px), 34px tall in the top bar, 40px for the empty-state action.
- **Pill (default):** chip grey fill, ink text, 14px/500, 0 14px padding; hover to chip-pressed grey.
- **Ink:** ink fill, paper text; hover drops to 0.85 opacity. Used for the theme toggle (34px circle) and the empty-state action (600 weight, 0 18px).
- **Icon button:** 36px transparent circle, slate icon (18px stroke SVG); hover fills chip grey and darkens to ink. Save (bookmark, filled when pressed) and "original" (arrow up-right) live here.
- **Press:** pills, ink and circle buttons scale to 0.95 on `:active` (100ms).
- **Focus:** 2px solid outline in `ink` (lime in dark) with 2px offset.

### Chips
- **Group chip (band only):** transparent, 1.5px ink border, 38px tall, a 26px ink count pill with lime numerals at its left. Hover inverts the whole chip to ink with lime text and a lime count pill. Clicking filters the stream to that group.
- **Entity chip:** chip-grey pill, 13px/500, 2px 10px; renders only when the item has entities.

### Inputs / Fields
- **Source select:** a native select styled as a chip-grey pill (34px, 0 32px 0 14px), with an 11px chevron SVG pinned 12px from the right; max-width 34vw on small screens.

### Navigation
- **View switch (Mới · Tất cả · Đã lưu):** text buttons, 15px slate; active is ink 600. A count pill (12px/600 tabular) follows: chip grey normally, ink with paper text when active.
- **Topic tabs:** 15px slate text with a 12px slate count; active is ink 600 with a 2px ink underline that scales in from the left (260ms, ease-out). Hover darkens to ink. The row scrolls sideways on phones.

### Feed Row
The core unit: no container, just type between hairlines.
- **Order:** title link → summary → entity chips → metadata line. Optional thumbnail on the right (88px phone, 168px tablet/desktop, 232px wide-without-side), 4:3, 6px radius, invisible until loaded, scaling to 1.03 on hover.
- **Metadata line:** "Topic · Source · time" in 14px slate, optional bold "Mới" badge with the dot before it, actions pushed right.
- **Title link:** no underline at rest; hover underlines at 1.5px thickness, 4px offset.
- **Seen:** title to slate 500, summary to slate, images to 0.7 opacity.

### Lead Story
The first item, larger: a 16:10 image (6px radius, image-ground behind, scale 1.02 on hover) beside a headline-size title and a 17px summary. Images narrower than 640px are rejected, and the lead falls back to the text-only variant at the larger headline size.

### Catch-up Band (signature)
Full-bleed lime field. One display sentence computed from the reader's last visit: the leading count in the width-125 numeral, the second clause in band olive ink. Group chips below, then a 14px olive note line ("Cập nhật 1 giờ trước"). In dark mode: deep olive field, lime numeral, chips outlined in 50% lime.

### New Dot
8px circle in ink with a 2.5px lime ring (dark: lime dot with olive ring). Marks items newer than the last visit until opened; carries `role="img"` and a label when it stands alone.

### Release Group
A row titled "Repo · N bản mới" with the version range (oldest → newest) at 0.72em in slate tabular numerals. A "show versions" disclosure (14px/600 ink, 11px chevron rotating 180° in 200ms) opens a ruled list of versions, max 420px.

### Industry Panel ("Tin ngành")
Lime-tint panel, 12px radius, 18px 22px 14px padding. 15px/600 heading, then one-liner links (15px/500, 1.4) separated by tint-rule hairlines, each with 13px slate metadata. Shows five, then a disclosure for the rest.

### Empty States
Title at clamp(22px → 28px)/600, a graphite note, and at most one ink pill action. Max 52ch.

## Do's and Don'ts

### Do:
- **Do** keep lime to the band field, plus dot rings, the band numeral (dark) and focus (dark).
- **Do** carry hierarchy with Mona Sans size and weight: 56 / 32 / 24 / 16px, 600 for headlines, negative tracking on anything 19px and up.
- **Do** separate items with 1px hairlines and generous padding (22px rows, 28px lead).
- **Do** make every control a full pill, every image 6px, and the single tinted panel 12px.
- **Do** render images only when an item has a usable one; let the row reflow to text-only otherwise.
- **Do** use tabular numerals for every count, and the `wdth` axis only for counts the reader acts on.
- **Do** write UI copy in Vietnamese first, keeping technical terms (agent, MCP, skill, release) in English.
- **Do** step opened items down to slate instead of hiding them.

### Don't:
- **Don't** bring back the frosted-glass look: no backdrop blur, no translucent panels, no gradient page background, no Lexend / Plus Jakarta Sans / IBM Plex Mono on migrated surfaces.
- **Don't** put items in cards with borders or shadows; the stream is type between rules.
- **Don't** add a second lime surface or a lime button.
- **Don't** show grey placeholder boxes for missing or loading images.
- **Don't** add uppercase kickers or eyebrow labels above headlines; topic and source belong in the metadata line.
