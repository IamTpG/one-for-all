import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  categoryAllowed,
  hostAllowed,
  isWithinRetention,
  retentionDaysFor,
  selectRecent,
  selectStableReleases,
  withOfficialRepos,
} from "./filters.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-11-25T06:00:00Z");
const daysAgo = (n: number) => new Date(now - n * DAY).toISOString();

test("selectRecent: drops old and undated entries, newest first, capped", () => {
  const entries = [
    { id: "old", publishedAt: daysAgo(40) },
    { id: "edge", publishedAt: daysAgo(13.9) },
    { id: "new", publishedAt: daysAgo(1) },
    { id: "undated" },
    { id: "bad", publishedAt: "nonsense" },
    { id: "mid", publishedAt: daysAgo(5) },
  ];
  const all = selectRecent(entries, { now, lookbackDays: 14, limit: 10 });
  assert.deepEqual(all.map((e) => e.id), ["new", "mid", "edge"]);
  const capped = selectRecent(entries, { now, lookbackDays: 14, limit: 2 });
  assert.deepEqual(capped.map((e) => e.id), ["new", "mid"]);
  assert.deepEqual(selectRecent(entries, { now, lookbackDays: 14, limit: 0 }), []);
});

test("categoryAllowed: allow-list with an empty string for no category", () => {
  const allowed = ["Product", "Company", ""];
  assert.ok(categoryAllowed(["Product"], allowed));
  assert.ok(categoryAllowed(["Science", "Company"], allowed));
  assert.ok(categoryAllowed([], allowed));
  assert.ok(!categoryAllowed(["Science"], allowed));
  assert.ok(!categoryAllowed([], ["Product"]));
  assert.ok(categoryAllowed(["anything"], undefined));
});

test("hostAllowed: https and listed hosts only", () => {
  const hosts = ["developers.openai.com", "learn.chatgpt.com"];
  assert.ok(hostAllowed("https://learn.chatgpt.com/docs/changelog/#x", hosts));
  assert.ok(!hostAllowed("http://learn.chatgpt.com/", hosts));
  assert.ok(!hostAllowed("https://evil.example.com/learn.chatgpt.com", hosts));
  assert.ok(!hostAllowed("https://learn.chatgpt.com.evil.example/", hosts));
  assert.ok(!hostAllowed("not a url", hosts));
});

test("selectStableReleases on saved gemini-cli releases: no prerelease or draft", () => {
  const releases = JSON.parse(
    readFileSync(new URL("./__fixtures__/github-releases-gemini-cli.json", import.meta.url), "utf8")
  ) as { tag_name: string; prerelease: boolean; draft: boolean }[];
  assert.ok(releases.some((r) => r.prerelease), "fixture should contain prereleases");
  const stable = selectStableReleases(releases, 6);
  assert.ok(stable.length > 0 && stable.length <= 6);
  for (const r of stable) {
    assert.equal(r.prerelease, false);
    assert.equal(r.draft, false);
    assert.ok(!/nightly|preview|alpha|beta/i.test(r.tag_name), r.tag_name);
  }
  assert.equal(selectStableReleases([{ prerelease: true }, { draft: true }], 5).length, 0);
});

test("selectRecent: a month-only date counts as published at the end of its month", () => {
  const entries = [
    { id: "nov", publishedAt: "2026-11-01T00:00:00.000Z", dateApprox: "month" as const },
    { id: "oct", publishedAt: "2026-10-01T00:00:00.000Z", dateApprox: "month" as const },
    { id: "nov-exact", publishedAt: "2026-11-01T00:00:00.000Z" },
  ];
  // On Nov 25 the 14-day cut is Nov 11: October (ended Oct 31) is out, the
  // November notes stay, and an exact Nov 1 date is out.
  const kept = selectRecent(entries, { now, lookbackDays: 14, limit: 10 });
  assert.deepEqual(kept.map((e) => e.id), ["nov"]);
  // Published dates are not rewritten.
  assert.equal(kept[0].publishedAt, "2026-11-01T00:00:00.000Z");
});

test("withOfficialRepos: official repos are always included, once", () => {
  assert.deepEqual(withOfficialRepos(["a/b", "x/claude-code"], ["x/claude-code", "g/cli"]), ["x/claude-code", "g/cli", "a/b"]);
  assert.deepEqual(withOfficialRepos([], ["g/cli"]), ["g/cli"]);
});

test("retention: official updates use the official window, others the default", () => {
  const days = { retentionDays: 3, officialRetentionDays: 30 };
  assert.equal(retentionDaysFor({}, days), 3);
  assert.equal(retentionDaysFor({ official: { kind: "feature" } }, days), 30);
  // a news-class official item not judged to be an update is a regular item
  assert.equal(retentionDaysFor({ official: {} }, days), 3);

  const tenDaysAgo = now - 10 * DAY;
  assert.equal(isWithinRetention(tenDaysAgo, now, retentionDaysFor({}, days)), false);
  assert.equal(isWithinRetention(tenDaysAgo, now, retentionDaysFor({ official: { kind: "pricing" } }, days)), true);
  assert.equal(isWithinRetention(now - 31 * DAY, now, 30), false);
});

test("retention: a kindless official item outlives the lookback, a community item does not", () => {
  const days = { retentionDays: 3, officialRetentionDays: 30, officialLookbackDays: 14 };
  assert.equal(retentionDaysFor({ official: {} }, days), 14);
  assert.equal(retentionDaysFor({}, days), 3);
  assert.equal(retentionDaysFor({ official: { kind: "feature" } }, days), 30);
  // retention shorter than the lookback never cuts an update inside the window
  assert.equal(retentionDaysFor({ official: { kind: "feature" } }, { ...days, officialRetentionDays: 7 }), 14);
  // 10 days old, kindless, 304 cycle: still kept
  assert.equal(isWithinRetention(now - 10 * DAY, now, retentionDaysFor({ official: {} }, days)), true);
});
