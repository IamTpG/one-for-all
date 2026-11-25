import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { kindFromLabels, parseMdOpenaiChangelog } from "./mdOpenaiChangelog.ts";

const md = readFileSync(new URL("../__fixtures__/openai-api-changelog.md", import.meta.url), "utf8");
const opts = { pageUrl: "https://developers.openai.com/api/docs/changelog", origin: "https://developers.openai.com" };

test("OpenAI API changelog: dated entries with the vendor's labels", () => {
  const entries = parseMdOpenaiChangelog(md, opts);
  assert.equal(entries.length, 8);
  assert.deepEqual(
    entries.map((e) => e.publishedAt?.slice(0, 10)),
    ["2026-11-24", "2026-11-24", "2026-11-19", "2026-11-17", "2026-11-17", "2026-11-16", "2023-10-16", "2023-10-06"]
  );
  assert.deepEqual(entries[0].labels, ["Update", "Model: chat-latest"]);
  assert.equal(entries[1].labels?.[0], "Feature");
  assert.ok(entries[1].labels?.includes("API: v1/responses"));
  // Two entries on the same day have different keys.
  assert.notEqual(entries[0].key, entries[1].key);
  assert.equal(new Set(entries.map((e) => e.key)).size, entries.length);
  assert.equal(entries[0].url, opts.pageUrl);
});

test("labels map to kinds", () => {
  const entries = parseMdOpenaiChangelog(md, opts);
  assert.equal(entries[0].kind, "api-change"); // Update
  assert.equal(entries[1].kind, "model-release"); // Feature + Model + "Released"
  assert.equal(entries[2].kind, "feature"); // Feature, no launch wording
  assert.equal(kindFromLabels(["Deprecation"], ""), "deprecation");
  assert.equal(kindFromLabels(["Pricing"], ""), "pricing");
  assert.equal(kindFromLabels(["Rate limits"], ""), "pricing");
  assert.equal(kindFromLabels(["Feature"], "Released a thing"), "feature");
  assert.equal(kindFromLabels(["Fix"], ""), "api-change");
});

test("an old entry with a bare label line and no Model labels parses", () => {
  const old = parseMdOpenaiChangelog(md, opts).at(-1)!;
  assert.deepEqual(old.labels, ["Update"]);
  assert.equal(old.publishedAt, "2023-10-06T00:00:00.000Z");
  assert.match(old.body ?? "", /function calling support/);
});

test("parsing twice gives identical entries", () => {
  assert.deepEqual(parseMdOpenaiChangelog(md, opts), parseMdOpenaiChangelog(md, opts));
});

test("a changelog without month and day headings parses to zero entries", () => {
  assert.equal(parseMdOpenaiChangelog(md.replace(/^### /gm, "#### "), opts).length, 0);
  assert.equal(parseMdOpenaiChangelog("Forbidden", opts).length, 0);
});
