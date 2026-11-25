import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToText, looksLikeHtml, truncateHtml } from "./text.ts";

test("htmlToText strips tags, scripts and decodes entities", () => {
  const text = htmlToText("<ul><li>A &amp; B</li><li>C</li></ul><script>x()</script>", 100);
  assert.equal(text, "A & B C");
});

test("htmlToText caps the length", () => {
  assert.equal(htmlToText("<p>" + "a".repeat(500) + "</p>", 280).length, 280);
});

test("truncateHtml never leaves a half-written tag", () => {
  const html = '<p>hello</p><a href="https://example.com/long/path">link</a>';
  const { html: cut, truncated } = truncateHtml(html, 30);
  assert.ok(truncated);
  assert.ok(!cut.includes("<a href"), cut);
  assert.equal(truncateHtml(html, 1000).truncated, false);
});

test("looksLikeHtml tells markdown from markup", () => {
  assert.ok(looksLikeHtml("<h2>New</h2>"));
  assert.ok(!looksLikeHtml("# Codex app\n\n- one **bold** item"));
});
