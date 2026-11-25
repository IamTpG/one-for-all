import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseMdDated } from "./mdDated.ts";

const md = readFileSync(new URL("../__fixtures__/gemini-api-changelog.md", import.meta.url), "utf8");
const opts = { pageUrl: "https://aistudio.google.com/docs/changelog", origin: "https://aistudio.google.com" };

test("Gemini API changelog: one entry per top-level bullet, dated from its section", () => {
  const entries = parseMdDated(md, opts);
  assert.equal(entries.length, 6);
  assert.deepEqual(
    entries.map((e) => e.publishedAt?.slice(0, 10)),
    ["2026-11-19", "2026-11-19", "2026-11-18", "2026-11-18", "2026-11-17", "2026-11-12"]
  );
  const [genie] = entries;
  assert.equal(genie.title, "Genie 4 (genie-4) generally available (GA)");
  assert.equal(genie.key, "2026-11-19-genie-4-genie-4-generally-available-ga");
  assert.equal(genie.url, "https://aistudio.google.com/docs/changelog#11-19-2026");
  assert.equal(genie.bodyFormat, "markdown");
  assert.equal(new Set(entries.map((e) => e.key)).size, entries.length);
});

test("root-relative links in the body become absolute and Markdoc tags are gone", () => {
  const [genie] = parseMdDated(md, opts);
  assert.match(genie.body ?? "", /\]\(https:\/\/aistudio\.google\.com\/docs\/models\/genie-4\)/);
  assert.ok(!/\{%/.test(genie.body ?? ""));
});

test("parsing twice gives identical entries", () => {
  assert.deepEqual(parseMdDated(md, opts), parseMdDated(md, opts));
});

test("a bullet without a bold title takes its first sentence; a repeated title gets a suffix", () => {
  const text = [
    '## May 2, 2026  {% id="05-02-2026" %}',
    "",
    "*   Released `gemini-9-flash` to general availability. More text here.",
    "*   **Same**: one",
    "*   **Same**: two",
  ].join("\n");
  const entries = parseMdDated(text, opts);
  assert.equal(entries[0].title, "Released gemini-9-flash to general availability.");
  assert.deepEqual(entries.slice(1).map((e) => e.key), ["2026-05-02-same", "2026-05-02-same-2"]);
});

test("a changelog without dated sections parses to zero entries", () => {
  assert.equal(parseMdDated(md.replace(/^## /gm, "### "), opts).length, 0);
  assert.equal(parseMdDated("", opts).length, 0);
});
