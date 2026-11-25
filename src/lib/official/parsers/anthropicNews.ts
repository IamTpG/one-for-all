import { parseHTML } from "linkedom";

// Pure parser for https://www.anthropic.com/news (string -> entries). Imports
// only linkedom so it runs under `node --test` outside Next.
//
// Anthropic's markup uses hashed CSS-module class names that change on every
// deploy, so this matches on structure only:
//   - a link to /news/<slug> that contains a heading is an article entry
//     (category links such as /news/announcements have no heading: skipped)
//   - the same article is linked several times (title, description, mobile
//     and desktop variants): entries are deduped by slug
//   - the date is the first <time> (or, failing that, nothing) in the nearest
//     ancestor that has one and does not belong to another article
//   - the summary is the first <p> inside a link to the same slug

export interface AnthropicNewsEntry {
  slug: string;
  title: string;
  url: string;
  summary?: string;
  /** ISO string, or undefined when no date could be read. */
  publishedAt?: string;
}

const BASE_URL = "https://www.anthropic.com";
const HREF_RE = /^(?:https:\/\/www\.anthropic\.com)?\/news\/([a-z0-9][a-z0-9-]*)\/?$/i;
const HEADING = "h1,h2,h3,h4";

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function toIso(text: string): string | undefined {
  if (!text) return undefined;
  const d = new Date(/^[a-z]{3}/i.test(text) ? `${text} UTC` : text);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function parseAnthropicNews(html: string): AnthropicNewsEntry[] {
  const { document } = parseHTML(html);
  const links = [...document.querySelectorAll("a[href]")].flatMap((a) => {
    const slug = a.getAttribute("href")?.match(HREF_RE)?.[1];
    return slug ? [{ a, slug }] : [];
  });

  const withHeading = links.filter(({ a }) => a.querySelector(HEADING));
  const entries = new Map<string, AnthropicNewsEntry>();

  for (const { a, slug } of withHeading) {
    const title = clean(a.querySelector(HEADING)?.textContent);
    if (!title) continue;

    let entry = entries.get(slug);
    if (!entry) {
      entry = { slug, title, url: `${BASE_URL}/news/${slug}` };
      entries.set(slug, entry);
    }

    if (!entry.publishedAt) {
      for (let el = a.parentElement; el; el = el.parentElement) {
        const foreign = withHeading.some(
          (o) => o.slug !== slug && el!.contains(o.a)
        );
        if (foreign) break;
        const time = el.querySelector("time");
        if (time) {
          entry.publishedAt = toIso(clean(time.getAttribute("datetime") || time.textContent));
          break;
        }
      }
    }
  }

  // Summary: first non-empty <p> inside any link to the same slug.
  for (const { a, slug } of links) {
    const entry = entries.get(slug);
    if (!entry || entry.summary) continue;
    const p = clean(a.querySelector("p")?.textContent);
    if (p) entry.summary = p;
  }

  return [...entries.values()];
}
