import { parseHTML } from "linkedom";

// `lang` is set only for headings known to be in another language than the
// page (an untranslated English remainder).
export type TocHeading = { id: string; text: string; lang?: "en" };

// Section headings the table of contents lists: the body's h2s (an h1 inside
// extracted content reads as a section heading too).
const SECTION_SELECTOR = "h1, h2";

// Gives every section heading a stable id ("muc-1", "muc-2", …) and returns
// the list. `start` continues the numbering across the translated part and
// the untranslated remainder, so ids stay unique on one page.
export function anchorSections(html: string, start = 0): { html: string; headings: TocHeading[] } {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const headings: TocHeading[] = [];
  for (const node of Array.from(document.querySelectorAll(SECTION_SELECTOR))) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const id = `muc-${start + headings.length + 1}`;
    node.setAttribute("id", id);
    headings.push({ id, text });
  }
  return { html: document.body.innerHTML, headings };
}
