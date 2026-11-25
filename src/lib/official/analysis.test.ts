import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TOPICS } from "../config.ts";
import { isOnTopic } from "../keywordTopics.ts";
import type { FeedItem, OfficialInfo } from "../types.ts";
import {
  buildOfficialPrompt,
  mergeOfficialAnalysis,
  parseOfficialAnalysis,
  prioritiseBody,
} from "./analysis.ts";
import { fallbackHeadline, isGenericTitle, officialTitle } from "./headline.ts";
import { parseOfficialRss } from "./parsers/rss.ts";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const valid = new Set(TOPICS.map((t) => t.id));

const BODY =
  "<p>Intro.</p><h3>Bug fixes</h3><ul><li>Fixed a crash on exit</li></ul>" +
  "<h3>Added</h3><ul><li>Added Code Mode support on Bedrock</li><li>Added /ship</li></ul>";

function official(over: Partial<FeedItem> = {}, info: Partial<OfficialInfo> = {}): FeedItem {
  return {
    id: "gh-release:anthropics/claude-code:1",
    source: "anthropics/claude-code releases",
    sourceId: "anthropics-claude-code-releases",
    sourceType: "github-release",
    title: "anthropics/claude-code: v2.1.331",
    url: "https://github.com/anthropics/claude-code/releases/tag/v2.1.331",
    publishedAt: "2026-11-24T00:00:00Z",
    fullContentHtml: BODY,
    official: { publisher: "anthropic", kind: "tool-release", kindFrom: "source", product: "Claude Code", ...info },
    ...over,
  };
}

test("official prompt: asks for every field, topics always, Added before Bug fixes", () => {
  const prompt = buildOfficialPrompt(official(), { sourceClass: "changelog" });
  for (const field of ["kind", "headline", "summary", "availability", "effectiveDate", "launchKey", "titleVi", "summaryVi", "topics"]) {
    assert.ok(prompt.includes(`"${field}"`), field);
  }
  for (const kind of ["model-release", "feature", "tool-release", "api-change", "deprecation", "pricing", "none"]) {
    assert.ok(prompt.includes(kind), kind);
  }
  assert.match(prompt, /^Official Anthropic changelog entry from "anthropics\/claude-code releases" \(product: Claude Code\)\./);
  for (const topic of TOPICS) assert.ok(prompt.includes(topic.id), topic.id);
  assert.ok(prompt.indexOf("Added Code Mode") < prompt.length);
  assert.ok(!prompt.includes("Fixed a crash"), "bug-fix section is dropped");
  assert.ok(prompt.indexOf("Added Code Mode") > prompt.indexOf("Content:"));
});

test("official prompt: content is capped at 2,000 chars; no body falls back to the summary", () => {
  const long = official({ fullContentHtml: "<p>" + "word ".repeat(2000) + "</p>" });
  const content = buildOfficialPrompt(long, { sourceClass: "news" }).split("Content: ")[1].split("\n\nReturn")[0];
  assert.ok(content.length <= 2000);
  const bare = official({ fullContentHtml: undefined, summary: "Short summary" });
  assert.match(buildOfficialPrompt(bare, { sourceClass: "news" }), /Content: Short summary/);
  assert.equal(prioritiseBody(BODY).includes("Fixed a crash"), false);
});

test("validator: good JSON keeps every field, trimmed", () => {
  const out = parseOfficialAnalysis(
    {
      kind: "Model-Release",
      headline: "  Gemini 4 Neon is generally available ",
      summary: " It is GA. ",
      availability: "Paid tier · API",
      effectiveDate: "2027-01-22",
      launchKey: "Gemini-4-Neon",
      titleVi: "Gemini 4 Neon đã GA",
      summaryVi: "Đã GA.",
      topics: ["ai-updates", "bogus", 3],
    },
    valid
  );
  assert.deepEqual(out, {
    summary: "It is GA.",
    topics: ["ai-updates"],
    kind: "model-release",
    titleVi: "Gemini 4 Neon đã GA",
    summaryVi: "Đã GA.",
    headline: "Gemini 4 Neon is generally available",
    availability: "Paid tier · API",
    effectiveDate: "2027-01-22",
    launchKey: "gemini-4-neon",
  });
});

test("validator: bad fields are dropped one by one, bad JSON shape is null", () => {
  const out = parseOfficialAnalysis(
    {
      kind: "announcement",
      headline: "x".repeat(300),
      summary: "ok",
      availability: 7,
      effectiveDate: "2027-02-30",
      launchKey: "Gemini 4 Neon!",
      topics: "ai-tools",
    },
    valid
  );
  assert.ok(out);
  assert.equal(out.kind, undefined);
  assert.equal(out.headline?.length, 120);
  assert.equal(out.availability, undefined);
  assert.equal(out.effectiveDate, undefined);
  assert.equal(out.launchKey, undefined);
  assert.deepEqual(out.topics, []);
  assert.equal(parseOfficialAnalysis({ launchKey: "a".repeat(61), summary: "s" }, valid)?.launchKey, undefined);
  assert.equal(parseOfficialAnalysis({ kind: "feature" }, valid), null);
  assert.equal(parseOfficialAnalysis({ summary: "  " }, valid), null);
  assert.equal(parseOfficialAnalysis(null, valid), null);
  assert.equal(parseOfficialAnalysis("text", valid), null);
  assert.equal(parseOfficialAnalysis({ kind: "none", summary: "s" }, valid)?.kind, "none");
});

test("merge: Groq's kind replaces a keyword kind and fills the extra fields", () => {
  const base: OfficialInfo = { publisher: "google", kind: "feature", kindFrom: "keyword" };
  const merged = mergeOfficialAnalysis(
    base,
    { summary: "s", topics: [], kind: "model-release", headline: "H", availability: "A", effectiveDate: "2027-01-01", launchKey: "gemini-4" },
    { sourceClass: "changelog", fixedKind: false }
  );
  assert.deepEqual(merged, { ...base, kind: "model-release", kindFrom: "groq", headline: "H", availability: "A", effectiveDate: "2027-01-01", launchKey: "gemini-4" });
});

test("merge: an invalid or missing kind keeps the keyword kind; a fixed kind is kept", () => {
  const keyword: OfficialInfo = { publisher: "openai", kind: "api-change", kindFrom: "keyword" };
  const noKind = mergeOfficialAnalysis(keyword, parseOfficialAnalysis({ kind: "bogus", summary: "s", headline: "H" }, valid)!, { sourceClass: "news", fixedKind: false });
  assert.equal(noKind?.kind, "api-change");
  assert.equal(noKind?.kindFrom, "keyword");
  assert.equal(noKind?.headline, "H");
  const fixed: OfficialInfo = { publisher: "anthropic", kind: "tool-release", kindFrom: "source" };
  const stays = mergeOfficialAnalysis(fixed, { summary: "s", topics: [], kind: "feature" }, { sourceClass: "changelog", fixedKind: true });
  assert.equal(stays?.kind, "tool-release");
  assert.equal(mergeOfficialAnalysis(undefined, { summary: "s", topics: [], kind: "feature" }, { sourceClass: "news", fixedKind: false }), undefined);
});

test("kind none: a news-class item stops being official and its topics decide; a changelog entry keeps its kind", () => {
  const story: FeedItem = {
    id: "anthropic:/news/story",
    source: "Anthropic",
    sourceId: "anthropic",
    sourceType: "rss",
    title: "How a customer built X with Claude",
    url: "https://www.anthropic.com/news/story",
    publishedAt: "2026-11-24T00:00:00Z",
    official: { publisher: "anthropic", kind: "api-change", kindFrom: "keyword", headline: "old" },
  };
  const analysis = { summary: "s", topics: ["ai-tools"], kind: "none" as const };
  const merged = mergeOfficialAnalysis(story.official, analysis, { sourceClass: "news", fixedKind: false })!;
  assert.equal(merged.kind, undefined);
  assert.equal(merged.kindFrom, "groq");
  assert.equal(merged.headline, undefined);
  assert.equal(isOnTopic({ topics: analysis.topics, official: merged }), true);
  assert.equal(isOnTopic({ topics: [], official: merged }), false, "no topic and no kind: off-topic like any regular item");

  const entry: OfficialInfo = { publisher: "openai", kind: "feature", kindFrom: "source" };
  assert.equal(mergeOfficialAnalysis(entry, analysis, { sourceClass: "changelog", fixedKind: false })?.kind, "feature");
});

test("generic titles are recognised", () => {
  for (const title of [
    "2.1.331",
    "anthropics/claude-code: v2.1.331",
    "Codex app",
    "Codex CLI Release: 0.131.0",
    "Claude Platform release notes — Nov 23, 2026",
  ]) {
    assert.equal(isGenericTitle(title, title.startsWith("Codex") ? "Codex" : "Claude Platform"), true, title);
  }
  assert.equal(isGenericTitle("Cowork merged into Chat", "Claude apps"), false);
  assert.equal(isGenericTitle("Codex runs parallel tasks in one repo", "Codex"), false);
});

test("fallback headline: product + first Added item, at most 90 chars; Groq's headline wins", () => {
  const item = official();
  assert.equal(fallbackHeadline(item), "Claude Code: Added Code Mode support on Bedrock");
  assert.equal(officialTitle(item), "Claude Code: Added Code Mode support on Bedrock");
  assert.equal(officialTitle(official({}, { headline: "Code Mode lands on Bedrock" })), "Code Mode lands on Bedrock");
  const long = official({ fullContentHtml: "<h2>New features</h2><ul><li>" + "Added a very long feature name ".repeat(8) + "</li></ul>" });
  const clipped = fallbackHeadline(long)!;
  assert.ok(clipped.length <= 90 && clipped.endsWith("…"), clipped);
  // no list item, a specific title, or no official info: the title stays
  assert.equal(officialTitle(official({ fullContentHtml: "<p>Only prose.</p>" })), "anthropics/claude-code: v2.1.331");
  assert.equal(officialTitle(official({ title: "Cowork merged into Chat" })), "Cowork merged into Chat");
  assert.equal(officialTitle({ title: "2.1.331", fullContentHtml: BODY }), "2.1.331");
  // a news-class item judged none has no kind, so its title is left alone
  assert.equal(officialTitle(official({}, { kind: undefined })), "anthropics/claude-code: v2.1.331");
});

test("fallback headline on a real Claude Platform release-notes entry", async () => {
  const entries = await parseOfficialRss(fixture("platform-rn.xml"));
  const first = entries[0];
  assert.ok(isGenericTitle(first.title, "Claude Platform"), first.title);
  const headline = fallbackHeadline({
    fullContentHtml: first.body,
    official: { publisher: "anthropic", kind: "api-change", kindFrom: "source", product: "Claude Platform" },
  });
  assert.ok(headline && headline.startsWith("Claude Platform: ") && headline.length <= 90, headline);
});
