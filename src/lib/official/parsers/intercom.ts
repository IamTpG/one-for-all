import { parseHTML } from "linkedom";
import type { ParsedEntry } from "./types.ts";
import { dayIso, keySlug, monthIndex, uniqueKey } from "./markdownText.ts";

// Pure parser for the help-center release-notes pages (Claude apps, ChatGPT,
// OpenAI models). The three pages use different markup but the same shape,
// so this walks the article in document order and goes by structure:
//   - a heading whose text is "Month D, YYYY" sets the date (and its id, if
//     it has one, is the anchor);
//   - a non-date heading (h1/h2) starts an entry; so does a bold-only
//     paragraph, unless a heading-titled entry is open (then it is a
//     sub-heading inside that entry's body);
//   - the blocks that follow, up to the next entry or date, are its body.
// Images and other media are dropped: rows are text-first.

const DATE_TEXT = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/;
const MONTH_ONLY = /^[A-Za-z]+\s+\d{4}$/;
const HEADING = /^h[1-6]$/;
const SKIP = new Set(["script", "style", "svg", "img", "picture", "figure", "iframe", "video", "audio", "button", "nav", "form", "noscript"]);
const LEAF = new Set(["p", "ul", "ol", "blockquote", "pre", "table", "dl"]);
const BLOCK = new Set(["p", "ul", "ol", "blockquote", "pre", "table", "dl", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6"]);
const BOLD_TITLE_MAX = 160;
const TITLE_MAX = 140;

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function parseDate(text: string): string | undefined {
  const m = text.match(DATE_TEXT);
  if (!m) return undefined;
  const month = monthIndex(m[1]);
  return month < 0 ? undefined : dayIso(Number(m[3]), month, Number(m[2]));
}

type El = Element;

// A paragraph whose whole text is bold: the title line of an entry.
function isBoldOnly(p: El): boolean {
  const text = clean(p.textContent);
  if (!text || text.length > BOLD_TITLE_MAX) return false;
  const bold = [...p.querySelectorAll("b, strong")].map((b) => clean(b.textContent)).join(" ");
  return clean(bold) === text;
}

export function parseIntercomNotes(html: string, opts: { pageUrl: string }): ParsedEntry[] {
  const { document } = parseHTML(html);

  // The article that holds the most date headings is the notes body: this
  // keeps page chrome (nav, "related articles") out of the walk.
  const countDates = (root: El) =>
    [...root.querySelectorAll("h1,h2,h3,h4")].filter((h) => parseDate(clean(h.textContent))).length;
  const roots = [...document.querySelectorAll("article")];
  const root: El = roots.sort((a, b) => countDates(b) - countDates(a))[0] ?? document.body;

  type Draft = { title: string; iso: string; anchor?: string; byHeading: boolean; blocks: string[] };
  const drafts: Draft[] = [];
  let date: { iso: string; anchor?: string } | null = null;
  let draft: Draft | null = null;

  const absolutize = (el: El) => {
    for (const a of el.querySelectorAll("a[href]")) {
      try {
        a.setAttribute("href", new URL(a.getAttribute("href") ?? "", opts.pageUrl).toString());
      } catch {
        a.removeAttribute("href");
      }
    }
  };

  const start = (title: string, byHeading: boolean) => {
    if (!date || !title) return;
    draft = { title: title.slice(0, TITLE_MAX), iso: date.iso, anchor: date.anchor, byHeading, blocks: [] };
    drafts.push(draft);
  };

  const addBlock = (el: El) => {
    if (!draft || !clean(el.textContent)) return;
    const copy = el.cloneNode(true) as El;
    absolutize(copy);
    for (const media of copy.querySelectorAll([...SKIP].join(","))) media.remove();
    draft.blocks.push(copy.outerHTML);
  };

  const walk = (el: El) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return;

    if (HEADING.test(tag)) {
      const text = clean(el.textContent);
      const iso = parseDate(text);
      if (iso) {
        date = { iso, anchor: el.getAttribute("id") || undefined };
        draft = null;
      } else if (!text || MONTH_ONLY.test(text)) {
        // empty heading or a "November 2026" group heading
      } else if (tag === "h1" || tag === "h2" || !draft) {
        start(text, true);
      } else {
        addBlock(el);
      }
      return;
    }
    if (tag === "p" && isBoldOnly(el)) {
      // Under a heading-titled entry a bold line is a sub-heading of its body.
      if (draft?.byHeading) addBlock(el);
      else start(clean(el.textContent), false);
      return;
    }
    const hasBlockChild = [...el.children].some((c) => BLOCK.has(c.tagName.toLowerCase()));
    if (LEAF.has(tag) || (tag === "div" && !hasBlockChild)) {
      addBlock(el);
      return;
    }
    for (const child of el.children) walk(child);
  };
  walk(root);

  const seen = new Set<string>();
  return drafts.map((d) => ({
    key: uniqueKey(seen, `${d.iso.slice(0, 10)}-${keySlug(d.title)}`),
    title: d.title,
    url: d.anchor ? `${opts.pageUrl}#${d.anchor}` : opts.pageUrl,
    publishedAt: d.iso,
    body: d.blocks.join("\n") || undefined,
    bodyFormat: "html" as const,
    categories: [],
  }));
}
