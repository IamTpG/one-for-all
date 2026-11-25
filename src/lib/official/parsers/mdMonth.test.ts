import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseMdMonth } from "./mdMonth.ts";

const md = readFileSync(new URL("../__fixtures__/xai-release-notes.md", import.meta.url), "utf8");
const opts = { pageUrl: "https://docs.x.ai/developers/release-notes", origin: "https://docs.x.ai", now: new Date("2026-11-25T00:00:00Z") };

test("xAI release notes: entries carry an approximate, month-only date", () => {
  const entries = parseMdMonth(md, opts);
  assert.equal(entries.length, 7);
  assert.ok(entries.every((e) => e.dateApprox === "month"));
  assert.deepEqual(
    entries.map((e) => e.publishedAt?.slice(0, 10)),
    ["2026-11-01", "2026-11-01", "2026-10-01", "2026-10-01", "2026-10-01", "2026-10-01", "2026-09-01"]
  );
  assert.equal(entries[0].title, "grok-build-0.1 end of life");
  assert.equal(entries[0].key, "grok-build-0-1-end-of-life");
  assert.equal(entries[0].url, opts.pageUrl);
});

test("keys do not depend on the date or on when it is parsed", () => {
  const november = parseMdMonth(md, opts).map((e) => e.key);
  const later = parseMdMonth(md, { ...opts, now: new Date("2026-12-20T00:00:00Z") }).map((e) => e.key);
  assert.deepEqual(later, november);
});

test("a month later than the current one belongs to the previous year, older months step back", () => {
  const text = "## December\n\n### A\n\nx\n\n## March\n\n### B\n\ny\n\n## March\n\n### C\n\nz\n";
  const entries = parseMdMonth(text, { ...opts, now: new Date("2026-02-10T00:00:00Z") });
  assert.deepEqual(entries.map((e) => e.publishedAt?.slice(0, 7)), ["2025-12", "2025-03", "2024-03"]);
});

test("markdown escapes are cleaned from the title and links in the body are absolute", () => {
  const entries = parseMdMonth(md, opts);
  assert.equal(entries[6].title, "safety_identifier request field");
  assert.match(entries[1].body ?? "", /\]\(https:\/\/docs\.x\.ai\/developers\/migration\//);
});

test("notes without month headings parse to zero entries", () => {
  assert.equal(parseMdMonth(md.replace(/^## /gm, "#### "), opts).length, 0);
  assert.equal(parseMdMonth("", opts).length, 0);
});
