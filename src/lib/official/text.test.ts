import assert from "node:assert/strict";
import { test } from "node:test";
import { clipSummary, htmlToText, looksLikeHtml, truncateHtml } from "./text.ts";

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

// The Anthropic API release note that was cut at 280 chars in the live feed.
const NOTE =
  "Claude Opus 4.7 now supports extended thinking with tool use. The new interleaved mode preserves reasoning when " +
  "the model calls tools between steps, so multi-step agents keep their chain of thought across calls. " +
  "Enable it with the interleaved-thinking beta header and a thinking budget on each request.";

test("clipSummary: short text is returned unchanged", () => {
  assert.equal(clipSummary("  One sentence.  ", 280), "One sentence.");
});

test("clipSummary: cuts at the last sentence end within the limit", () => {
  const out = clipSummary(NOTE, 140);
  assert.equal(out, "Claude Opus 4.7 now supports extended thinking with tool use.");
  assert.ok(out.length <= 140);
});

test("clipSummary: keeps several sentences when they fit", () => {
  const out = clipSummary(NOTE, 280);
  assert.ok(out.endsWith("across calls."), out);
  assert.ok(out.length <= 280);
});

test("clipSummary: no sentence end in range cuts at a word with an ellipsis", () => {
  const out = clipSummary("Short. " + "word ".repeat(80), 100);
  assert.ok(out.endsWith("word…"), out);
  assert.ok(out.length <= 100);
  const noEnd = clipSummary("The interleaved mode preserves reasoning when the model calls tools between steps and more", 60);
  assert.equal(noEnd, "The interleaved mode preserves reasoning when the model…");
});

test("clipSummary: version numbers are not sentence ends", () => {
  const out = clipSummary("Update to v2.1.0 today for the new hooks and plugin loader which landed in the last release cycle", 50);
  assert.ok(out.endsWith("…"), out);
  assert.ok(!out.endsWith("v2."), out);
});
