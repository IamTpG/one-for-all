import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseAnthropicNews } from "./anthropicNews.ts";

const html = readFileSync(
  new URL("../__fixtures__/anthropic-news.html", import.meta.url),
  "utf8"
);

test("parses the saved /news page into titled, dated, unique entries", () => {
  const entries = parseAnthropicNews(html);
  assert.ok(entries.length >= 10, `got ${entries.length}`);
  assert.equal(new Set(entries.map((e) => e.slug)).size, entries.length);
  for (const e of entries) {
    assert.ok(e.title, e.slug);
    assert.equal(e.url, `https://www.anthropic.com/news/${e.slug}`);
    assert.ok(e.publishedAt, `no date for ${e.slug}`);
  }
  assert.ok(!entries.some((e) => e.slug === "announcements"));
});

test("a page without headings parses to zero entries", () => {
  const noTitles = html.replace(/<(\/?)h[1-4]\b/g, "<$1span");
  assert.equal(parseAnthropicNews(noTitles).length, 0);
});
