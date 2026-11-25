import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalUrl, isEntryUrl } from "./canonical.ts";

test("lowercases the host, strips www and the trailing slash", () => {
  assert.equal(canonicalUrl("HTTPS://WWW.Anthropic.com/news/claude-5/"), "https://anthropic.com/news/claude-5");
  assert.equal(canonicalUrl("http://openai.com/index/x"), "https://openai.com/index/x");
});

test("drops tracking params and keeps real ones in a stable order", () => {
  assert.equal(
    canonicalUrl("https://blog.google/a/?utm_source=x&b=2&fbclid=1&a=1&ref=hn&gclid=z"),
    "https://blog.google/a?a=1&b=2"
  );
});

test("keeps the fragment only on changelog hosts", () => {
  assert.equal(
    canonicalUrl("https://platform.claude.com/docs/en/release-notes/overview#analytics-api"),
    "https://platform.claude.com/docs/en/release-notes/overview#analytics-api"
  );
  assert.equal(canonicalUrl("https://openai.com/index/x#section"), "https://openai.com/index/x");
});

test("an HN-style link and the official URL canonicalise the same", () => {
  assert.equal(
    canonicalUrl("https://www.anthropic.com/news/claude-5?utm_source=hn"),
    canonicalUrl("https://anthropic.com/news/claude-5/")
  );
});

test("isEntryUrl: a bare changelog-page URL identifies no entry, an anchored one does", () => {
  const bare = canonicalUrl("https://help.openai.com/en/articles/6825453-chatgpt-release-notes")!;
  const anchored = canonicalUrl("https://help.openai.com/en/articles/6825453-chatgpt-release-notes#h_abc")!;
  assert.equal(isEntryUrl(bare), false);
  assert.equal(isEntryUrl(anchored), true);
  assert.equal(isEntryUrl(canonicalUrl("https://openai.com/news/gpt-6")!), true);
});

test("unparseable or non-http URLs are null", () => {
  assert.equal(canonicalUrl("not a url"), null);
  assert.equal(canonicalUrl("javascript:alert(1)"), null);
  assert.equal(canonicalUrl("ftp://example.com/x"), null);
});
