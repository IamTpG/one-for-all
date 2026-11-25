import assert from "node:assert/strict";
import { test } from "node:test";
import { coerceHealth, isStuck, sortHealthRows, updateHealth, type SourceHealth } from "./health.ts";

const T0 = Date.parse("2026-11-25T00:00:00Z");
const ok = (count: number) => ({ label: "S", ok: true, count });
const fail = (error = "boom") => ({ label: "S", ok: false, count: 0, error });

test("updateHealth: first success", () => {
  const h = updateHealth(undefined, ok(4), T0);
  assert.equal(h.lastOkAt, T0);
  assert.equal(h.lastCount, 4);
  assert.equal(h.consecutiveFailures, 0);
  assert.equal(h.consecutiveZeroRuns, 0);
  assert.equal(h.lastError, undefined);
});

test("updateHealth: failures accumulate, keep the last OK time and count, and reset on success", () => {
  let h = updateHealth(undefined, ok(4), T0);
  h = updateHealth(h, fail("a"), T0 + 1);
  h = updateHealth(h, fail("b"), T0 + 2);
  assert.equal(h.consecutiveFailures, 2);
  assert.equal(h.lastOkAt, T0);
  assert.equal(h.lastCount, 4);
  assert.equal(h.lastError, "b");
  h = updateHealth(h, ok(2), T0 + 3);
  assert.equal(h.consecutiveFailures, 0);
  assert.equal(h.lastError, undefined);
  assert.equal(h.lastOkAt, T0 + 3);
});

test("updateHealth: a source that never succeeded has lastOkAt null", () => {
  const h = updateHealth(undefined, fail(), T0);
  assert.equal(h.lastOkAt, null);
  assert.equal(h.consecutiveFailures, 1);
});

test("updateHealth: zero-entry runs count up and reset on a non-empty run", () => {
  let h = updateHealth(undefined, ok(0), T0);
  h = updateHealth(h, ok(0), T0 + 1);
  assert.equal(h.consecutiveZeroRuns, 2);
  h = updateHealth(h, ok(3), T0 + 2);
  assert.equal(h.consecutiveZeroRuns, 0);
});

test("updateHealth: a quiet source (entries parsed, all older than the lookback) is not a zero run", () => {
  let h = updateHealth(undefined, { label: "S", ok: true, count: 0, parsed: 40 }, T0);
  h = updateHealth(h, { label: "S", ok: true, count: 0, parsed: 40 }, T0 + 1);
  h = updateHealth(h, { label: "S", ok: true, count: 0, parsed: 40 }, T0 + 2);
  assert.equal(h.consecutiveZeroRuns, 0);
  assert.equal(h.lastCount, 0);
  assert.ok(!isStuck(h));
  h = updateHealth(h, { label: "S", ok: true, count: 0, parsed: 0 }, T0 + 3);
  assert.equal(h.consecutiveZeroRuns, 1);
  h = updateHealth(h, { label: "S", ok: true, count: 0, parsed: 12 }, T0 + 4);
  assert.equal(h.consecutiveZeroRuns, 0);
});

test("updateHealth: a failure does not reset the zero-entry streak", () => {
  let h = updateHealth(undefined, ok(0), T0);
  h = updateHealth(h, fail(), T0 + 1);
  assert.equal(h.consecutiveZeroRuns, 1);
});

test("updateHealth: 304 is ok, clears failures, and leaves count and zero streak alone", () => {
  let h = updateHealth(undefined, ok(0), T0);
  h = updateHealth(h, fail(), T0 + 1);
  h = updateHealth(h, { label: "S", ok: true, count: 0, notModified: true }, T0 + 2);
  assert.equal(h.consecutiveFailures, 0);
  assert.equal(h.consecutiveZeroRuns, 1);
  assert.equal(h.lastNotModified, true);
  assert.equal(h.lastOkAt, T0 + 2);
  h = updateHealth(h, ok(5), T0 + 3);
  assert.equal(h.lastNotModified, undefined);
  assert.equal(h.lastCount, 5);
});

test("updateHealth: long errors are cut", () => {
  assert.equal(updateHealth(undefined, fail("x".repeat(1000)), T0).lastError?.length, 300);
});

test("isStuck: three failures or three empty runs", () => {
  assert.ok(!isStuck({ consecutiveFailures: 2, consecutiveZeroRuns: 2 }));
  assert.ok(isStuck({ consecutiveFailures: 3, consecutiveZeroRuns: 0 }));
  assert.ok(isStuck({ consecutiveFailures: 0, consecutiveZeroRuns: 3 }));
});

test("coerceHealth: rejects junk, defaults missing numbers", () => {
  assert.equal(coerceHealth(null), null);
  assert.equal(coerceHealth({ lastOkAt: 1 }), null);
  const h = coerceHealth({ label: "S", consecutiveFailures: -4, lastOkAt: "x" }) as SourceHealth;
  assert.equal(h.consecutiveFailures, 0);
  assert.equal(h.lastOkAt, null);
});

test("sortHealthRows: failing first, then empty, then healthy, never-run last", () => {
  const row = (name: string, f: number, z: number) => ({ name, health: { consecutiveFailures: f, consecutiveZeroRuns: z, lastOkAt: 1 } });
  const sorted = sortHealthRows([
    row("healthy-b", 0, 0),
    { name: "never", health: null },
    row("empty", 0, 4),
    row("fail-1", 1, 0),
    row("healthy-a", 0, 0),
    row("fail-5", 5, 0),
  ]);
  assert.deepEqual(sorted.map((r) => r.name), ["fail-5", "fail-1", "empty", "healthy-a", "healthy-b", "never"]);
});
