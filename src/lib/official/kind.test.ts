import assert from "node:assert/strict";
import { test } from "node:test";
import { isUpdateKind, keywordKind, modelIdKey, resolveKind } from "./kind.ts";

test("keywordKind: ordered rules", () => {
  assert.equal(keywordKind("GPT-5.1 retires from ChatGPT on October 3"), "deprecation");
  assert.equal(keywordKind("Custom prompts deprecated"), "deprecation");
  assert.equal(keywordKind("New rate limits for the Responses API"), "pricing");
  assert.equal(keywordKind("Introducing Gemini 4 Neon"), "model-release");
  assert.equal(keywordKind("Genie 4 is now available"), "model-release");
  assert.equal(keywordKind("Claude Opus 5 is generally available"), "model-release");
  assert.equal(keywordKind("Added a new parameter to the batch endpoint"), "api-change");
  assert.equal(keywordKind("How iFood scales coding agents"), undefined);
});

test("keywordKind: a launch word alone is not a model release", () => {
  assert.equal(keywordKind("Introducing ChatGPT Wallet"), undefined);
});

test("resolveKind: source default wins over keywords", () => {
  const r = resolveKind({
    title: "Opus 4.5 retired",
    sourceClass: "changelog",
    defaultKind: "api-change",
  });
  assert.deepEqual(r, { kind: "api-change", kindFrom: "source" });
});

test("resolveKind: title rules fix part of a mixed source", () => {
  const rules = [{ titlePattern: "^Codex CLI Release:", kind: "tool-release" as const }];
  const cli = resolveKind({ title: "Codex CLI Release: 0.172.0", body: "API changes", sourceClass: "changelog", rules });
  assert.deepEqual(cli, { kind: "tool-release", kindFrom: "source" });
  const app = resolveKind({ title: "Codex app", sourceClass: "changelog", rules });
  assert.deepEqual(app, { kind: "feature", kindFrom: "source" });
});

test("resolveKind: keywords, then changelog fallback, then undefined for news", () => {
  assert.deepEqual(resolveKind({ title: "Introducing Gemini 4 Neon", sourceClass: "news" }), {
    kind: "model-release",
    kindFrom: "keyword",
  });
  assert.equal(resolveKind({ title: "A customer story", sourceClass: "news" }).kind, undefined);
  assert.equal(resolveKind({ title: "Browser upgrades", sourceClass: "changelog" }).kind, "feature");
});

test("isUpdateKind", () => {
  assert.ok(isUpdateKind("deprecation"));
  assert.ok(!isUpdateKind("none"));
  assert.ok(!isUpdateKind(undefined));
});

test("modelIdKey: the first model id as a slug", () => {
  assert.equal(modelIdKey("Introducing Gemini 4 Neon"), "gemini-4");
  assert.equal(modelIdKey("Claude Opus 4.5 retired"), "claude-opus-4-5");
  assert.equal(modelIdKey("GPT-5.1 now in the API"), "gpt-5-1");
  assert.equal(modelIdKey("Grok 5 is here"), "grok-5");
  assert.equal(modelIdKey("Cowork merged into Chat"), undefined);
});
