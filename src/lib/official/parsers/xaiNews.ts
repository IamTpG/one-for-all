import { parseHTML } from "linkedom";
import type { ParsedEntry } from "./types.ts";

// Pure parser for https://x.ai/news (string -> entries). Cards are links to
// /news/<slug> that contain a heading. Only some cards show a date, so the
// rest take it from sitemap.xml (<lastmod> of the news URL); a card with no
// date from either is skipped, never given today's date.

const BASE_URL = "https://x.ai";
const HREF_RE = /^(?:https:\/\/x\.ai)?\/news\/([A-Za-z0-9][A-Za-z0-9._-]*)\/?$/;
const HEADING = "h1,h2,h3,h4";
const DATE_TEXT = /^[A-Za-z]{3,9}\.?\s+\d{1,2},\s*\d{4}$/;

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function toIso(text: string): string | undefined {
  if (!text) return undefined;
  const d = new Date(/^[a-z]{3}/i.test(text) ? `${text} UTC` : text);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// slug -> ISO date, for the https://x.ai/news/<slug> URLs in sitemap.xml.
export function parseXaiSitemap(xml: string): Map<string, string> {
  const dates = new Map<string, string>();
  const re = /<loc>\s*https:\/\/x\.ai\/news\/([^<\s/]+)\s*<\/loc>\s*<lastmod>\s*([^<\s]+)\s*<\/lastmod>/g;
  for (const m of xml.matchAll(re)) {
    const iso = toIso(m[2]);
    if (iso) dates.set(m[1], iso);
  }
  return dates;
}

export function parseXaiNews(html: string, sitemapDates: ReadonlyMap<string, string> = new Map()): ParsedEntry[] {
  const { document } = parseHTML(html);
  const entries = new Map<string, ParsedEntry>();

  for (const a of document.querySelectorAll("a[href]")) {
    const slug = a.getAttribute("href")?.match(HREF_RE)?.[1];
    if (!slug) continue;
    const heading = a.querySelector(HEADING);
    const title = clean(heading?.textContent);
    if (!title) continue;

    const paragraphs = [...a.querySelectorAll("p")].map((p) => clean(p.textContent)).filter(Boolean);
    const time = a.querySelector("time");
    const dateText = clean(time?.getAttribute("datetime") || time?.textContent) || paragraphs.find((p) => DATE_TEXT.test(p)) || "";
    const publishedAt = toIso(dateText) ?? sitemapDates.get(slug);
    const summary = paragraphs.find((p) => !DATE_TEXT.test(p));

    const existing = entries.get(slug);
    if (existing) {
      existing.publishedAt ??= publishedAt;
      existing.summary ??= summary;
      continue;
    }
    entries.set(slug, {
      key: slug,
      title,
      url: `${BASE_URL}/news/${slug}`,
      publishedAt,
      summary,
      categories: [],
    });
  }
  return [...entries.values()].filter((e) => e.publishedAt);
}
