import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseXaiNews, parseXaiSitemap } from "./xaiNews.ts";

const read = (name: string) => readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), "utf8");
const html = read("xai-news.html");
const sitemap = parseXaiSitemap(read("xai-sitemap.xml"));

test("sitemap lastmod dates are read per news slug", () => {
  assert.equal(sitemap.size, 5);
  assert.equal(sitemap.get("incident-sweep"), "2026-10-20T00:00:00.000Z");
  assert.equal(sitemap.has("x-subscription"), false);
});

test("x.ai/news: card dates win, the sitemap fills the rest, undated cards are skipped", () => {
  const entries = parseXaiNews(html, sitemap);
  assert.deepEqual(entries.map((e) => e.key), ["grok-bot-1-0", "grok-bot-accounting", "data-bot", "incident-sweep", "grok-voice-3"]);
  assert.deepEqual(
    entries.map((e) => e.publishedAt?.slice(0, 10)),
    ["2026-11-11", "2026-11-16", "2026-11-02", "2026-10-20", "2026-10-14"]
  );
  assert.equal(entries[0].title, "Introducing Grok Bot 1.0");
  assert.equal(entries[0].url, "https://x.ai/news/grok-bot-1-0");
  // The featured card's date line is not its summary.
  assert.ok(entries[0].summary && !/^Nov /.test(entries[0].summary));
  // The category link has no heading: not an entry.
  assert.ok(!entries.some((e) => e.key === "category"));
});

test("without a sitemap only cards that show their own date remain", () => {
  const entries = parseXaiNews(html);
  assert.deepEqual(entries.map((e) => e.key), ["grok-bot-1-0", "grok-bot-accounting", "data-bot"]);
});

test("parsing twice gives identical entries", () => {
  assert.deepEqual(parseXaiNews(html, sitemap), parseXaiNews(html, sitemap));
});

test("a page without headings parses to zero entries", () => {
  assert.equal(parseXaiNews(html.replace(/<(\/?)h[1-4]\b/g, "<$1span"), sitemap).length, 0);
  assert.equal(parseXaiNews("<html><body>Attention Required</body></html>", sitemap).length, 0);
});
