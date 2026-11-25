import { marked } from "marked";
import {
  OFFICIAL_FETCH_TIMEOUT_MS,
  OFFICIAL_MAX_BODY_CHARS,
  OFFICIAL_MAX_RESPONSE_BYTES,
} from "@/lib/config";
import { errorMessage } from "@/lib/errors";
import { OFFICIAL_USER_AGENT } from "@/lib/http";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import type { SiteSettings } from "@/lib/siteSettings";
import type { FeedItem, FetchSourceResult } from "@/lib/types";
import { categoryAllowed, hostAllowed, selectRecent } from "@/lib/official/filters";
import {
  conditionalHeaders,
  validatorFromHeaders,
  validatorSignature,
  type SourceValidator,
} from "@/lib/official/validators";
import { resolveKind } from "@/lib/official/kind";
import { parseAnthropicNews } from "@/lib/official/parsers/anthropicNews";
import { parseIntercomNotes } from "@/lib/official/parsers/intercom";
import { parseMdDated } from "@/lib/official/parsers/mdDated";
import { parseMdMonth } from "@/lib/official/parsers/mdMonth";
import { parseMdOpenaiChangelog } from "@/lib/official/parsers/mdOpenaiChangelog";
import { parseOfficialRss } from "@/lib/official/parsers/rss";
import type { ParsedEntry } from "@/lib/official/parsers/types";
import { parseXaiNews, parseXaiSitemap } from "@/lib/official/parsers/xaiNews";
import { OFFICIAL_SOURCES, type OfficialSourceConfig } from "@/lib/official/sources";
import { clipSummary, htmlToText, looksLikeHtml, truncateHtml } from "@/lib/official/text";

const MAX_REDIRECTS = 5;
const SUMMARY_CHARS = 280;
// Text read from the body before it is clipped to SUMMARY_CHARS.
const SUMMARY_SOURCE_CHARS = 2000;
const SEQUENTIAL_GAP_MS = 1000;

type Entry = ParsedEntry;

const ACCEPT: Record<OfficialSourceConfig["format"], string> = {
  rss: "application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
  "anthropic-news": "text/html, application/xhtml+xml, */*;q=0.5",
  "xai-news": "text/html, application/xhtml+xml, */*;q=0.5",
  "intercom-html": "text/html, application/xhtml+xml, */*;q=0.5",
  "md-openai-changelog": "text/markdown, text/plain;q=0.9, */*;q=0.5",
  "md-dated": "text/markdown, text/plain;q=0.9, */*;q=0.5",
  "md-month": "text/markdown, text/plain;q=0.9, */*;q=0.5",
};

// Formats parsed from a page's own structure (not a feed or an article
// list): their items are sourceType "changelog".
const CHANGELOG_FORMATS = new Set<OfficialSourceConfig["format"]>([
  "intercom-html",
  "md-openai-changelog",
  "md-dated",
  "md-month",
]);

// What one GET came back with: the body, or "not modified" when the source
// answered 304 to our validators. `validator` is what to send next time.
type Fetched = { notModified: true } | { notModified: false; text: string; validator?: SourceValidator };

// GET with fail-closed rules: https only, every redirect hop must stay on the
// source's host allowlist, the whole request (headers and body) shares one
// timeout, and the body is read with a hard size cap. With `conditional`
// (the main page only, not the sitemap) the stored validators are sent and a
// 304 comes back as `notModified`.
async function fetchBounded(
  source: OfficialSourceConfig,
  startUrl: string = source.url,
  conditional?: { validator?: SourceValidator; signature: string }
): Promise<Fetched> {
  const extraHeaders = conditional ? conditionalHeaders(conditional.validator, conditional.signature) : {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFFICIAL_FETCH_TIMEOUT_MS);
  try {
    let url = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!hostAllowed(url, source.hostAllowlist)) {
        throw new Error(`${source.name}: refusing to fetch ${new URL(url).host} (not on the allowlist)`);
      }
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        cache: "no-store",
        headers: {
          "User-Agent": OFFICIAL_USER_AGENT,
          Accept: ACCEPT[source.format],
          "Accept-Language": "en",
          ...extraHeaders,
        },
      });
      if (res.status === 304) {
        // Only valid as the answer to a conditional request we really sent.
        if (Object.keys(extraHeaders).length === 0) throw new Error(`${source.name} returned 304 to an unconditional request`);
        await res.body?.cancel();
        return { notModified: true };
      }
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel();
        const location = res.headers.get("location");
        if (!location) throw new Error(`${source.name}: redirect ${res.status} without a location`);
        url = new URL(location, url).toString();
        continue;
      }
      if (!res.ok) throw new Error(`${source.name} returned ${res.status}`);
      const text = await readCapped(res, OFFICIAL_MAX_RESPONSE_BYTES, source.name);
      return {
        notModified: false,
        text,
        validator: conditional ? validatorFromHeaders(res.headers, conditional.signature) : undefined,
      };
    }
    throw new Error(`${source.name}: too many redirects`);
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res: Response, maxBytes: number, label: string): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`${label}: response is ${declared} bytes, over the ${maxBytes} cap`);
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`${label}: response is over the ${maxBytes} byte cap`);
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

// The origin entry links and relative markdown links resolve against.
function pageOf(source: OfficialSourceConfig): { pageUrl: string; origin: string } {
  const pageUrl = source.pageUrl ?? source.url;
  return { pageUrl, origin: new URL(pageUrl).origin };
}

type Loaded = { notModified: true } | { notModified: false; entries: Entry[]; validator?: SourceValidator };

async function loadEntries(
  source: OfficialSourceConfig,
  now: number,
  conditional: { validator?: SourceValidator; signature: string }
): Promise<Loaded> {
  const fetched = await fetchBounded(source, source.url, conditional);
  if (fetched.notModified) return { notModified: true };
  const entries = parseEntries(source, fetched.text, now);
  return { notModified: false, entries: await entries, validator: fetched.validator };
}

async function parseEntries(source: OfficialSourceConfig, text: string, now: number): Promise<Entry[]> {
  const page = pageOf(source);
  switch (source.format) {
    case "anthropic-news":
      return parseAnthropicNews(text).map((e) => ({
        key: e.slug,
        title: e.title,
        url: e.url,
        publishedAt: e.publishedAt,
        summary: e.summary,
        categories: [],
      }));
    case "intercom-html":
      return parseIntercomNotes(text, page);
    case "md-openai-changelog":
      return parseMdOpenaiChangelog(text, page);
    case "md-dated":
      return parseMdDated(text, page);
    case "md-month":
      return parseMdMonth(text, { ...page, now: new Date(now) });
    case "xai-news": {
      // The sitemap only fills in dates: if it fails, cards that show their
      // own date still parse and the rest are skipped.
      let dates = new Map<string, string>();
      if (source.sitemapUrl) {
        try {
          const sitemap = await fetchBounded(source, source.sitemapUrl);
          if (!sitemap.notModified) dates = parseXaiSitemap(sitemap.text);
        } catch (err) {
          console.error(`[official] ${source.name}: sitemap unavailable:`, err);
        }
      }
      return parseXaiNews(text, dates);
    }
    case "rss":
      return parseOfficialRss(text);
  }
}

function toItem(source: OfficialSourceConfig, entry: Entry): FeedItem {
  const isHtml = entry.bodyFormat ? entry.bodyFormat === "html" : entry.body ? looksLikeHtml(entry.body) : false;
  const rendered = entry.body
    ? isHtml
      ? entry.body
      : (marked.parse(entry.body, { async: false }) as string)
    : "";
  const { html } = truncateHtml(rendered, OFFICIAL_MAX_BODY_CHARS);
  const fullContentHtml = html ? sanitizeArticleHtml(html) : undefined;
  const summary = entry.summary ?? clipSummary(htmlToText(rendered, SUMMARY_SOURCE_CHARS), SUMMARY_CHARS);

  // A kind the source itself states (OpenAI API changelog labels) wins over
  // keyword guessing, but not over the source's own defaultKind.
  const { kind, kindFrom } =
    entry.kind && !source.defaultKind
      ? { kind: entry.kind, kindFrom: "source" as const }
      : resolveKind({
          title: entry.title,
          body: summary,
          sourceClass: source.class,
          defaultKind: source.defaultKind,
          rules: source.kindRules,
        });

  return {
    id: `${source.idPrefix ?? `official:${source.id}:`}${entry.key}`,
    source: source.name,
    sourceId: source.id,
    sourceType: CHANGELOG_FORMATS.has(source.format) ? "changelog" : "rss",
    title: entry.title,
    url: entry.url,
    summary,
    publishedAt: entry.publishedAt ?? new Date().toISOString(),
    fullContentHtml,
    official: {
      publisher: source.publisher,
      kind,
      kindFrom,
      product: source.product,
      ...(entry.dateApprox ? { dateApprox: entry.dateApprox } : {}),
    },
  };
}

async function fetchOne(
  source: OfficialSourceConfig,
  opts: { now: number; limit: number; lookbackDays: number },
  validator: SourceValidator | undefined
): Promise<FetchSourceResult> {
  const base = { sourceId: source.id, label: source.name };
  try {
    const loaded = await loadEntries(source, opts.now, { validator, signature: validatorSignature(opts) });
    if (loaded.notModified) {
      // Nothing changed since the stored validators: ok, no new entries. The
      // items already stored stay (retention keeps them).
      console.log(`[official] ${source.name}: 304 not modified`);
      return { ...base, items: [], ok: true, notModified: true };
    }
    const { entries } = loaded;
    // A 200 that parses to nothing means the format changed: report it
    // instead of showing a healthy source with no items.
    if (entries.length === 0) {
      throw new Error(`${source.name}: 0 entries parsed, layout changed?`);
    }

    const wanted = entries.filter(
      (entry) =>
        hostAllowed(entry.url, source.hostAllowlist) &&
        categoryAllowed(entry.categories, source.allowCategories) &&
        !(source.excludeUrlParts ?? []).some((part) => entry.url.includes(part))
    );
    const recent = selectRecent(wanted, opts);
    return {
      ...base,
      items: recent.map((entry) => toItem(source, entry)),
      ok: true,
      parsed: entries.length,
      ...(loaded.validator ? { validator: loaded.validator } : {}),
    };
  } catch (err) {
    console.error(`[official] failed to fetch ${source.name}:`, err);
    return { ...base, items: [], ok: false, error: errorMessage(err) };
  }
}

// Fetches every enabled official source; one failing source never affects
// the others. A disabled source makes no request at all. Sources in the same
// sequentialGroup run one after another with a gap, every other source (and
// every group) runs in parallel.
export async function fetchOfficialSources(
  settings: Pick<SiteSettings, "disabledFeeds" | "officialItemLimit" | "officialLookbackDays">,
  now: number = Date.now(),
  validators: ReadonlyMap<string, SourceValidator> = new Map()
): Promise<FetchSourceResult[]> {
  const disabled = new Set(settings.disabledFeeds);
  const opts = { now, limit: settings.officialItemLimit, lookbackDays: settings.officialLookbackDays };
  const enabled = OFFICIAL_SOURCES.filter((source) => !disabled.has(source.id));

  const groups = new Map<string, OfficialSourceConfig[]>();
  for (const source of enabled) {
    const group = source.sequentialGroup ?? `source:${source.id}`;
    groups.set(group, [...(groups.get(group) ?? []), source]);
  }

  const perGroup = await Promise.all(
    [...groups.values()].map(async (sources) => {
      const results: FetchSourceResult[] = [];
      for (const [index, source] of sources.entries()) {
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, SEQUENTIAL_GAP_MS));
        results.push(await fetchOne(source, opts, validators.get(source.id)));
      }
      return results;
    })
  );
  return perGroup.flat();
}
