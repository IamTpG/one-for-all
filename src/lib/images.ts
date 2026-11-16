// Recognises the same picture behind different URLs: size or quality query
// variants (?w=1024, ?q=w_1280), HTML-escaped ampersands, and image proxies
// that wrap the original (Next.js /_next/image?url=…, GitBook ?url=…,
// Substack /image/fetch/…/https%3A…).
export function imageKey(raw: string, depth = 0): string | null {
  const value = raw.replace(/&amp;/g, "&").trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (depth < 3) {
    const inner = url.searchParams.get("url");
    if (inner) {
      try {
        return imageKey(new URL(inner, url.origin).toString(), depth + 1);
      } catch {
        // Not a URL after all: fall through to this URL's own key.
      }
    }
    const nested = url.pathname.search(/\/https?(%3A|:)/i);
    if (nested >= 0) {
      try {
        return imageKey(decodeURIComponent(url.pathname.slice(nested + 1)), depth + 1);
      } catch {
        // Malformed escape: fall through.
      }
    }
  }
  return `${url.hostname}${url.pathname}`.toLowerCase();
}

const IMG_TAG = /<img\b[^>]*>/gi;
const SRC_ATTR = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function srcOf(tag: string): string | null {
  const match = tag.match(SRC_ATTR);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

// True when the body already shows this picture, so the page must not put
// it above the body a second time.
export function bodyHasImage(html: string | null, imageUrl: string | undefined): boolean {
  if (!html || !imageUrl) return false;
  const key = imageKey(imageUrl);
  if (!key) return false;
  for (const tag of html.match(IMG_TAG) ?? []) {
    const src = srcOf(tag);
    if (src && imageKey(src) === key) return true;
  }
  return false;
}

const ALT_ATTR = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function altOf(tag: string): string {
  const match = tag.match(ALT_ATTR);
  return (match ? (match[1] ?? match[2] ?? "") : "").trim();
}

// Drops images that extraction repeated:
// - one that repeats the image right before it with no text in between
//   (a <picture> source plus its <img> fallback, a lazy-load placeholder
//   plus the real image);
// - one with the same picture and the same non-empty alt text as an
//   earlier image (a video widget's poster kept twice, with player chrome
//   in between).
// A picture reused on purpose without alt text, such as a section divider,
// is left alone.
export function dedupeImages(html: string): string {
  let previousKey: string | null = null;
  let previousEnd = 0;
  const seenWithAlt = new Set<string>();
  let out = "";
  let cursor = 0;
  for (const match of html.matchAll(IMG_TAG)) {
    const start = match.index ?? 0;
    const tag = match[0];
    const src = srcOf(tag);
    const key = src ? imageKey(src) : null;
    const alt = altOf(tag);
    const between = html.slice(previousEnd, start).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    const repeatsPrevious = key !== null && key === previousKey && !between;
    const repeatsWithAlt = key !== null && alt !== "" && seenWithAlt.has(`${key}\n${alt}`);
    out += html.slice(cursor, start);
    if (!repeatsPrevious && !repeatsWithAlt) out += tag;
    if (key && alt) seenWithAlt.add(`${key}\n${alt}`);
    cursor = start + tag.length;
    if (key) {
      previousKey = key;
      previousEnd = cursor;
    }
  }
  return out + html.slice(cursor);
}

// Paragraphs and figures left with nothing in them (extraction leftovers,
// or a figure whose repeated image was dropped) would still add their
// margins as blank gaps.
const EMPTY_BLOCK = /<(p|figure)>(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi;

export function tidyBody(html: string | null): string | null {
  if (!html) return html;
  const tidy = dedupeImages(html).replace(EMPTY_BLOCK, "").trim();
  return tidy || null;
}
