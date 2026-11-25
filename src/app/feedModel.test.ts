import assert from "node:assert/strict";
import { test } from "node:test";
import { filterOptions, itemFilterKey } from "../lib/sourceRegistry.ts";
import type { FeedItem } from "../lib/types.ts";
import {
  attachCoverage,
  countEntries,
  groupEntries,
  isNewItem,
  isValidFilters,
  matchesSources,
  matchesTopic,
  parseFilters,
} from "./feedModel.ts";

const options = filterOptions();
const DAY = 86_400_000;
const NOW = Date.parse("2026-11-25T06:00:00Z");
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

function item(over: Partial<FeedItem> & { id: string }): FeedItem {
  return {
    source: "Source",
    sourceId: "simon-willison",
    sourceType: "rss",
    title: over.id,
    url: "https://example.com/" + over.id,
    publishedAt: iso(0),
    topics: ["ai-workflow"],
    ...over,
  };
}

const official = (id: string, publisher: string, over: Partial<FeedItem> = {}) =>
  item({
    id,
    sourceId: "claude-platform-release-notes",
    sourceType: "rss",
    topics: [],
    official: { publisher, kind: "feature", kindFrom: "source" },
    ...over,
  });

test("itemFilterKey: official update -> publisher; vendor story -> null; others -> their source", () => {
  assert.equal(itemFilterKey(official("a", "anthropic")), "anthropic");
  const story = item({ id: "s", sourceId: "anthropic", official: { publisher: "anthropic", kindFrom: "keyword" } });
  assert.equal(itemFilterKey(story), null);
  // an old stored item of an official source that predates `official`
  assert.equal(itemFilterKey(item({ id: "o", sourceId: "openai-news" })), null);
  assert.equal(itemFilterKey(item({ id: "h", sourceId: "hacker-news", sourceType: "hn" })), "hacker-news");
  assert.equal(itemFilterKey(item({ id: "r", sourceId: "block-goose-releases", sourceType: "github-release" })), "github-releases");
  const claudeCode = item({
    id: "gh-release:anthropics/claude-code:1",
    sourceId: "anthropics-claude-code-releases",
    sourceType: "github-release",
    official: { publisher: "anthropic", kind: "tool-release", kindFrom: "source", product: "Claude Code" },
  });
  assert.equal(itemFilterKey(claudeCode), "anthropic");
});

test("matchesSources: empty selects everything, a selection matches by key only", () => {
  const a = official("a", "anthropic");
  const o = official("o", "openai");
  const hn = item({ id: "h", sourceId: "hacker-news", sourceType: "hn" });
  const story = item({ id: "s", sourceId: "anthropic", official: { publisher: "anthropic", kindFrom: "keyword" } });
  for (const x of [a, o, hn, story]) assert.equal(matchesSources(x, []), true);
  assert.equal(matchesSources(a, ["anthropic"]), true);
  assert.equal(matchesSources(o, ["anthropic"]), false);
  assert.equal(matchesSources(hn, ["anthropic"]), false);
  assert.equal(matchesSources(hn, ["anthropic", "hacker-news"]), true);
  assert.equal(matchesSources(story, ["anthropic"]), false);
  // A community item that merely mentions a vendor never shows under it.
  assert.equal(matchesSources(item({ id: "m", title: "Anthropic ships Claude" }), ["anthropic"]), false);
});

test("an official update with no topic is on-topic and shows under 'all', not off-topic", () => {
  const a = official("a", "anthropic");
  assert.equal(matchesTopic(a, "all"), true);
  assert.equal(matchesTopic(a, "off-topic"), false);
  assert.equal(matchesTopic(a, "ai-tools"), false);
});

test("parseFilters: current shape, with sources cleaned", () => {
  const out = parseFilters({ view: "new", topic: "ai-tools", sources: ["openai", "nope", "anthropic"] }, options);
  assert.deepEqual(out, { view: "new", topic: "ai-tools", sources: ["anthropic", "openai"] });
});

test("parseFilters: old saved states with `source` still load", () => {
  assert.deepEqual(parseFilters({ view: null, topic: "all", source: "all" }, options), { view: null, topic: "all", sources: [] });
  assert.deepEqual(parseFilters({ view: "all", topic: "career", source: "src:lobsters" }, options), { view: "all", topic: "career", sources: ["lobsters"] });
  assert.deepEqual(parseFilters({ view: "all", topic: "all", source: "src:gone-feed" }, options), { view: "all", topic: "all", sources: [] });
  assert.deepEqual(parseFilters({ view: "all", topic: "all", source: "type:github-release" }, options), { view: "all", topic: "all", sources: [] });
  assert.deepEqual(parseFilters({ view: "all", topic: "all", source: "type:bogus" }, options), { view: "all", topic: "all", sources: [] });
});

test("parseFilters / isValidFilters: rejects garbage", () => {
  assert.equal(parseFilters(null, options), null);
  assert.equal(parseFilters("x", options), null);
  assert.equal(parseFilters({ view: "weird", topic: "all", sources: [] }, options), null);
  assert.equal(parseFilters({ view: null, topic: "nope", sources: [] }, options), null);
  assert.equal(parseFilters({ view: null, topic: "all" }, options), null);
  assert.equal(isValidFilters({ view: null, topic: "all", sources: [] }, options), true);
  assert.equal(isValidFilters({ view: null, topic: "all", source: "all" }, options), true);
  assert.equal(isValidFilters({ view: null, topic: "all", source: 3 }, options), false);
});

test("isNewItem: newer than the baseline, official items also not back-dated", () => {
  const baseline = NOW - 2 * DAY;
  const fresh = item({ id: "f", firstSeenAt: NOW - DAY, publishedAt: iso(1) });
  assert.equal(isNewItem(fresh, baseline), true);
  assert.equal(isNewItem(fresh, null), false);
  assert.equal(isNewItem(item({ id: "o", firstSeenAt: NOW - 3 * DAY, publishedAt: iso(3) }), baseline), false);

  // First seen after the baseline but published 20 days before it: a seed or
  // a back-dated changelog entry, not news.
  const seed = official("seed", "openai", { firstSeenAt: NOW - DAY, publishedAt: iso(22) });
  assert.equal(isNewItem(seed, baseline), false);
  // Within 7 days before the baseline still counts (published just before the
  // reader left, fetched after).
  const near = official("near", "openai", { firstSeenAt: NOW - DAY, publishedAt: iso(6) });
  assert.equal(isNewItem(near, baseline), true);
  // The same back-dated age on a community item keeps today's rule.
  assert.equal(isNewItem(item({ id: "c", firstSeenAt: NOW - DAY, publishedAt: iso(22) }), baseline), true);
  // No publish date to trust: first-seen alone decides.
  assert.equal(isNewItem(official("bad", "openai", { firstSeenAt: NOW - DAY, publishedAt: "nonsense" }), baseline), true);
});

test("official tool releases group per product, GitHub releases per repo", () => {
  const codex = (n: number) =>
    item({
      id: "codex" + n,
      sourceId: "codex-changelog",
      title: "Codex CLI Release: 0.13" + n,
      topics: [],
      publishedAt: iso(n),
      official: { publisher: "openai", kind: "tool-release", kindFrom: "source", product: "Codex" },
    });
  const entries = groupEntries([codex(1), official("x", "openai"), codex(2), codex(3)]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].kind, "releases");
  if (entries[0].kind === "releases") {
    assert.equal(entries[0].label, "Codex");
    assert.equal(entries[0].items.length, 3);
  }
  assert.equal(countEntries([codex(1), official("x", "openai"), codex(2), codex(3)]), 2);
  const single = groupEntries([codex(1), official("x", "openai")]);
  assert.deepEqual(single.map((e) => e.kind), ["item", "item"]);
});

const group = (id: string, publisher: string, daysAgo: number, over: Partial<FeedItem> = {}) =>
  official(id, publisher, { publishedAt: iso(daysAgo), ...over });
const withKey = (key: string | undefined, kind: "model-release" | "feature" = "model-release") => ({
  official: { publisher: "google", kind, kindFrom: "groq" as const, launchKey: key },
});

test("attachCoverage: a community item with an official item's URL is hidden and counted", () => {
  const post = official("post", "openai", { sourceId: "openai-news", url: "https://openai.com/news/gpt-6?utm_source=x" });
  const hn = item({ id: "hn", sourceId: "hacker-news", sourceType: "hn", url: "https://www.openai.com/news/gpt-6/" });
  const lob = item({ id: "lob", url: "https://openai.com/news/gpt-6#comments-ignored" });
  const other = item({ id: "other", url: "https://example.com/else" });
  const out = attachCoverage([hn, post, lob, other]);
  assert.deepEqual(out.map((i) => i.id), ["post", "other"]);
  assert.equal(out.find((i) => i.id === "post")?.coverageCount, 3);
  assert.equal(attachCoverage([post, other]).find((i) => i.id === "post")?.coverageCount, undefined);
  assert.equal(post.coverageCount, undefined, "the input item is not mutated");
});

test("attachCoverage: unanchored changelog pages and duplicate URLs absorb nothing", () => {
  // Several ChatGPT notes share one page URL and have no anchor.
  const page = "https://help.openai.com/en/articles/6825453-chatgpt-release-notes";
  const a = official("a", "openai", { url: page });
  const b = official("b", "openai", { url: page });
  const link = item({ id: "link", url: page });
  assert.deepEqual(attachCoverage([a, b, link]).map((i) => i.id), ["a", "b", "link"]);
  assert.equal(attachCoverage([a, link]).length, 2, "even a single entry on a bare changelog page URL");
  // Anchored entries on the same page are distinct, and a link to the anchor folds into only its entry.
  const x = official("x", "openai", { url: page + "#h_x" });
  const y = official("y", "openai", { url: page + "#h_y" });
  const toX = item({ id: "toX", url: page + "#h_x" });
  const out = attachCoverage([x, y, toX]);
  assert.deepEqual(out.map((i) => i.id), ["x", "y"]);
  assert.equal(out[0].coverageCount, 2);
  assert.equal(out[1].coverageCount, undefined);
  // The same URL on two official items (a blog post mirrored by two sources) is ambiguous.
  const m1 = official("m1", "google", { url: "https://blog.google/p" });
  const m2 = official("m2", "google", { url: "https://blog.google/p" });
  assert.equal(attachCoverage([m1, m2, item({ id: "c", url: "https://blog.google/p" })]).length, 3);
});

test("attachCoverage: a vendor story judged not an update is not a target and is not hidden", () => {
  const story = item({ id: "story", url: "https://www.anthropic.com/news/s", official: { publisher: "anthropic", kindFrom: "groq" } });
  const hn = item({ id: "hn", url: "https://www.anthropic.com/news/s" });
  assert.deepEqual(attachCoverage([story, hn]).map((i) => i.id), ["story", "hn"]);
});

test("LaunchGroup: same publisher and launchKey within 7 days is one row led by the changelog entry", () => {
  const blog = group("blog", "google", 1, { sourceId: "google-deepmind-blog", ...withKey("gemini-4-neon") });
  const dev = group("dev", "google", 2, { sourceId: "google-developers-blog", ...withKey("gemini-4-neon") });
  const changelog = group("changelog", "google", 4, { sourceId: "gemini-api-changelog", sourceType: "changelog", ...withKey("gemini-4-neon") });
  const entries = groupEntries([blog, dev, changelog, item({ id: "plain" })]);
  assert.equal(entries.length, 2);
  const launch = entries[0];
  assert.equal(launch.kind, "launch");
  if (launch.kind === "launch") {
    assert.equal(launch.lead.id, "changelog");
    assert.deepEqual(launch.items.map((i) => i.id), ["changelog", "blog", "dev"]);
  }
  assert.equal(countEntries([blog, dev, changelog, item({ id: "plain" })]), 2);
});

test("LaunchGroup: generic launchKeys (publisher, product, vendor words) never collapse entries", () => {
  for (const key of ["google", "Codex", "gemini", "chatgpt", "claude", "Gemini CLI"]) {
    const a = group("a", "google", 0, { sourceId: "google-deepmind-blog", ...withKey(key) });
    const b = group("b", "google", 1, { sourceId: "google-developers-blog", ...withKey(key) });
    a.official!.product = "Gemini CLI";
    b.official!.product = "Gemini CLI";
    assert.deepEqual(groupEntries([a, b]).map((e) => e.kind), ["item", "item"], key);
  }
  const x = group("x", "google", 0, withKey("gemini-4-neon"));
  const y = group("y", "google", 1, withKey("gemini-4-neon"));
  assert.equal(groupEntries([x, y])[0].kind, "launch");
});

test("LaunchGroup: another publisher, another key, or more than 7 days apart stay separate rows", () => {
  const a = group("a", "google", 0, { sourceId: "google-deepmind-blog", ...withKey("gemini-4-neon") });
  const otherPublisher = group("o", "openai", 1, { ...withKey("gemini-4-neon") });
  otherPublisher.official!.publisher = "openai";
  const otherKey = group("k", "google", 1, { sourceId: "google-developers-blog", ...withKey("gemma-5") });
  const late = group("late", "google", 9, { sourceId: "gemini-api-changelog", ...withKey("gemini-4-neon") });
  const noKey = group("n", "google", 2, { sourceId: "google-developers-blog", ...withKey(undefined, "feature") });
  const entries = groupEntries([a, otherPublisher, otherKey, noKey, late]);
  assert.deepEqual(entries.map((e) => e.kind), ["item", "item", "item", "item", "item"]);
});

test("LaunchGroup: without Groq a model-release groups by the model id in its title; tool releases keep per-product groups", () => {
  const mk = (id: string, days: number, title: string) =>
    group(id, "xai", days, {
      title,
      official: { publisher: "xai", kind: "model-release", kindFrom: "keyword" },
    });
  const entries = groupEntries([
    mk("a", 0, "Introducing Grok 5"),
    mk("b", 2, "Grok 5 is now available in the API"),
    mk("c", 3, "Grok 4.2 mini"),
  ]);
  assert.deepEqual(entries.map((e) => e.kind), ["launch", "item"]);
  const feature = group("f", "xai", 1, { title: "Grok 5 voice", official: { publisher: "xai", kind: "feature", kindFrom: "keyword" } });
  assert.equal(groupEntries([mk("a", 0, "Introducing Grok 5"), feature]).length, 2, "only model releases fall back to the title");
});
