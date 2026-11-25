import assert from "node:assert/strict";
import { test } from "node:test";
import { coerceValidator, conditionalHeaders, validatorFromHeaders, validatorSignature } from "./validators.ts";

const sig = validatorSignature({ limit: 6, lookbackDays: 14 });
const headers = (init: Record<string, string>) => ({ get: (name: string) => init[name.toLowerCase()] ?? null });

test("validatorFromHeaders: keeps ETag and Last-Modified, none means no validator", () => {
  assert.deepEqual(validatorFromHeaders(headers({ etag: 'W/"abc"', "last-modified": "Tue, 24 Nov 2026 10:00:00 GMT" }), sig), {
    etag: 'W/"abc"',
    lastModified: "Tue, 24 Nov 2026 10:00:00 GMT",
    signature: sig,
  });
  assert.deepEqual(validatorFromHeaders(headers({ etag: '"x"' }), sig), { etag: '"x"', signature: sig });
  assert.equal(validatorFromHeaders(headers({}), sig), undefined);
});

test("validatorFromHeaders: rejects control characters and oversized values", () => {
  assert.equal(validatorFromHeaders(headers({ etag: '"a"\r\nX-Evil: 1' }), sig), undefined);
  assert.equal(validatorFromHeaders(headers({ etag: '"' + "a".repeat(600) + '"' }), sig), undefined);
});

test("conditionalHeaders: sends both validators, and none after the settings changed", () => {
  const v = { etag: '"abc"', lastModified: "Tue, 24 Nov 2026 10:00:00 GMT", signature: sig };
  assert.deepEqual(conditionalHeaders(v, sig), {
    "If-None-Match": '"abc"',
    "If-Modified-Since": "Tue, 24 Nov 2026 10:00:00 GMT",
  });
  assert.deepEqual(conditionalHeaders(v, validatorSignature({ limit: 10, lookbackDays: 14 })), {});
  assert.deepEqual(conditionalHeaders(v, validatorSignature({ limit: 6, lookbackDays: 30 })), {});
  assert.deepEqual(conditionalHeaders(undefined, sig), {});
  assert.deepEqual(conditionalHeaders({ etag: '"e"', signature: sig }, sig), { "If-None-Match": '"e"' });
});

test("coerceValidator: tolerates junk from Redis", () => {
  assert.equal(coerceValidator(null), null);
  assert.equal(coerceValidator("x"), null);
  assert.equal(coerceValidator({ signature: sig }), null);
  assert.equal(coerceValidator({ etag: 5, signature: sig }), null);
  assert.equal(coerceValidator({ etag: '"a"' }), null);
  assert.deepEqual(coerceValidator({ etag: '"a"', signature: sig, extra: 1 }), { etag: '"a"', signature: sig });
});
