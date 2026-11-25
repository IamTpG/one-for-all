import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateStatus, type StatusInputs } from "./dashboardStatus.ts";

const now = Date.parse("2026-11-25T06:00:00Z");
const base: StatusInputs = {
  now,
  redisUp: true,
  lastTickTs: now - 60_000,
  longestTickMs: 5000,
  dueSlot: null,
  lastRunTs: now - 60_000,
  sourcesFailed: 0,
  sourcesTotal: 20,
  backlog: 0,
  groqTokensPercent: 10,
  groqPausedUntil: null,
  upstashBandwidthPercent: null,
};
const src = (name: string, f = 0, z = 0) => ({ name, consecutiveFailures: f, consecutiveZeroRuns: z });
const officialCheck = (officialSources: StatusInputs["officialSources"]) =>
  evaluateStatus({ ...base, officialSources }).checks.find((c) => c.id === "official");

test("official: no check without health data", () => {
  assert.equal(officialCheck(undefined), undefined);
  assert.equal(officialCheck([]), undefined);
  assert.equal(evaluateStatus(base).level, "ok");
});

test("official: ok below three failures or empty runs", () => {
  const check = officialCheck([src("a", 2, 2), src("b"), src("c"), src("d")]);
  assert.equal(check?.level, "ok");
  assert.equal(check?.label, "Official 4/4");
});

test("official: warn at three consecutive failures", () => {
  const result = evaluateStatus({ ...base, officialSources: [src("Claude apps", 3), src("b"), src("c"), src("d")] });
  const check = result.checks.find((c) => c.id === "official");
  assert.equal(check?.level, "warn");
  assert.equal(result.level, "warn");
  assert.match(result.verdict, /Claude apps/);
});

test("official: warn at three consecutive zero-entry runs", () => {
  assert.equal(officialCheck([src("a", 0, 3), src("b"), src("c")])?.level, "warn");
});

test("official: bad once half of the sources are stuck", () => {
  assert.equal(officialCheck([src("a", 3), src("b", 0, 5), src("c"), src("d")])?.level, "bad");
  assert.equal(officialCheck([src("a", 3), src("b"), src("c"), src("d")])?.level, "warn");
  assert.equal(officialCheck([src("a", 4)])?.level, "bad");
});

test("official: a single failed run does not count", () => {
  assert.equal(officialCheck([src("a", 1), src("b", 2), src("c")])?.level, "ok");
});
