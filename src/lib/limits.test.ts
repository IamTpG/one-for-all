import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanStringList,
  coerceNumber,
  coerceWholeLimit,
  coerceWholeLimits,
  parseLimitInput,
  resolveLimits,
  FETCH_TIME_PATTERN,
  REPO_PATTERN,
  SOURCE_ID_PATTERN,
} from "./limits.ts";

test("coerceNumber: positive finite numbers pass, everything else falls back", () => {
  assert.equal(coerceNumber(6, 1), 6);
  assert.equal(coerceNumber(0, 5), 5);
  assert.equal(coerceNumber(-3, 5), 5);
  assert.equal(coerceNumber(Number.NaN, 5), 5);
  assert.equal(coerceNumber(Infinity, 5), 5);
  assert.equal(coerceNumber("12", 5), 5);
  assert.equal(coerceNumber(null, 5), 5);
  assert.equal(coerceNumber(undefined, 5), 5);
});

test("coerceWholeLimit: floors, and never goes below 1", () => {
  assert.equal(coerceWholeLimit(2.9, 6), 2);
  assert.equal(coerceWholeLimit(0.5, 6), 6);
  assert.equal(coerceWholeLimit("7", 6), 6);
  assert.equal(coerceWholeLimit(30, 6), 30);
});

test("coerceWholeLimits: only known keys, bad values keep the current one", () => {
  const current = { officialItemLimit: 6, officialLookbackDays: 14 };
  assert.deepEqual(
    coerceWholeLimits({ officialItemLimit: 10, officialLookbackDays: -1, extra: 99 } as never, current),
    { officialItemLimit: 10, officialLookbackDays: 14 }
  );
  assert.deepEqual(coerceWholeLimits({}, current), current);
});

test("coerceWholeLimits: clamps to the upper bounds", () => {
  const current = { officialItemLimit: 6, officialLookbackDays: 14, retentionDays: 3, officialRetentionDays: 30 };
  assert.deepEqual(
    coerceWholeLimits({ officialItemLimit: 5000, officialLookbackDays: 99999, retentionDays: 366, officialRetentionDays: 365 }, current),
    { officialItemLimit: 50, officialLookbackDays: 365, retentionDays: 365, officialRetentionDays: 365 }
  );
});

test("cleanStringList: arrays of matching strings only", () => {
  assert.deepEqual(cleanStringList(["a-b", "c"], SOURCE_ID_PATTERN), ["a-b", "c"]);
  assert.equal(cleanStringList("a", SOURCE_ID_PATTERN), null);
  assert.equal(cleanStringList(["ok", 5], SOURCE_ID_PATTERN), null);
  assert.equal(cleanStringList(["Bad Id"], SOURCE_ID_PATTERN), null);
  assert.equal(cleanStringList(new Array(300).fill("a"), SOURCE_ID_PATTERN), null);
  assert.deepEqual(cleanStringList(["anthropics/claude-code"], REPO_PATTERN), ["anthropics/claude-code"]);
  assert.equal(cleanStringList(["no-slash"], REPO_PATTERN), null);
  assert.deepEqual(cleanStringList(["08:30", "23:59"], FETCH_TIME_PATTERN), ["08:30", "23:59"]);
  assert.equal(cleanStringList(["24:00"], FETCH_TIME_PATTERN), null);
});

test("resolveLimits: reports invalid and clamped fields next to the stored values", () => {
  const current = { officialItemLimit: 6, officialLookbackDays: 14, rssItemLimit: 8 };
  const { values, issues } = resolveLimits(
    { officialItemLimit: 99999, officialLookbackDays: -5, rssItemLimit: 20 },
    current
  );
  assert.deepEqual(values, { officialItemLimit: 50, officialLookbackDays: 14, rssItemLimit: 20 });
  assert.deepEqual(issues, { officialItemLimit: "clamped", officialLookbackDays: "invalid" });
});

test("resolveLimits: zero, NaN and strings are invalid; a value at the bound is fine", () => {
  const current = { officialItemLimit: 6, officialLookbackDays: 14, rssItemLimit: 8 };
  const { values, issues } = resolveLimits(
    { officialItemLimit: 50, officialLookbackDays: 0, rssItemLimit: "9" },
    current
  );
  assert.deepEqual(values, { officialItemLimit: 50, officialLookbackDays: 14, rssItemLimit: 8 });
  assert.deepEqual(issues, { officialLookbackDays: "invalid", rssItemLimit: "invalid" });
});

test("parseLimitInput: positive whole numbers only", () => {
  assert.equal(parseLimitInput("12"), 12);
  assert.equal(parseLimitInput(" 7 "), 7);
  assert.equal(parseLimitInput("99999"), 99999);
  for (const bad of ["", "0", "-5", "2.5", "1e3", "abc", "  ", "99999999999999999999"]) {
    assert.equal(parseLimitInput(bad), null, bad);
  }
});
