import assert from "node:assert/strict";
import { test } from "node:test";
import { filterOptions } from "../lib/sourceRegistry.ts";
import {
  groupState,
  normaliseSources,
  parseSourcesParam,
  parseStoredSources,
  removeIds,
  resolveSources,
  selectionChips,
  sourcesParam,
  toggleGroup,
  toggleOption,
  triggerLabel,
} from "./sourceFilterModel.ts";

const options = filterOptions();
const officialIds = options.official.map((o) => o.id);
const communityIds = options.community.map((o) => o.id);
const labels = { all: "Mọi nguồn", allOfficial: "Tất cả chính thức", community: "Cộng đồng & báo chí" };

test("filterOptions: publishers first, community sources after, registry-driven", () => {
  assert.deepEqual(officialIds, ["anthropic", "openai", "google", "xai"]);
  assert.ok(communityIds.includes("hacker-news"));
  assert.ok(communityIds.includes("github-trending"));
  assert.ok(communityIds.includes("github-releases"));
  assert.ok(communityIds.includes("simon-willison"));
  assert.equal(new Set([...officialIds, ...communityIds]).size, officialIds.length + communityIds.length);
});

test("filterOptions: a disabled community source is not offered; a publisher stays while one source is on", () => {
  const some = filterOptions(new Set(["lobsters", "claude-articles"]));
  assert.ok(!some.community.some((o) => o.id === "lobsters"));
  assert.ok(some.official.some((o) => o.id === "anthropic"));
  const none = filterOptions(new Set(["anthropic", "claude-platform-release-notes", "claude-articles", "claude-apps-release-notes"]));
  assert.ok(!none.official.some((o) => o.id === "anthropic"));
});

test("normaliseSources: drops unknown ids, de-duplicates, follows dropdown order", () => {
  assert.deepEqual(normaliseSources(["openai", "nope", "anthropic", "openai"], options), ["anthropic", "openai"]);
  assert.deepEqual(normaliseSources(["nope"], options), []);
  assert.deepEqual(normaliseSources([], options), []);
  assert.deepEqual(normaliseSources("anthropic", options), []);
  assert.deepEqual(normaliseSources([1, null, "google"], options), ["google"]);
});

test("normaliseSources: a selection covering every option is no filter", () => {
  assert.deepEqual(normaliseSources([...officialIds, ...communityIds], options), []);
  const almost = [...officialIds, ...communityIds].slice(1);
  assert.equal(normaliseSources(almost, options).length, almost.length);
});

test("toggleOption: narrows from empty, removes, and normalises", () => {
  assert.deepEqual(toggleOption([], "anthropic", options), ["anthropic"]);
  assert.deepEqual(toggleOption(["anthropic"], "openai", options), ["anthropic", "openai"]);
  assert.deepEqual(toggleOption(["anthropic", "openai"], "anthropic", options), ["openai"]);
  assert.deepEqual(toggleOption(["anthropic"], "anthropic", options), []);
  const all = [...officialIds, ...communityIds];
  assert.deepEqual(toggleOption(all.slice(1), all[0], options), []);
});

test("groupState / toggleGroup are tri-state", () => {
  assert.equal(groupState([], options, "official"), "none");
  assert.equal(groupState(["anthropic"], options, "official"), "some");
  assert.equal(groupState(officialIds, options, "official"), "all");
  assert.equal(groupState(officialIds, options, "community"), "none");
  assert.deepEqual(toggleGroup([], "official", options), officialIds);
  assert.deepEqual(toggleGroup(["anthropic"], "official", options), officialIds);
  assert.deepEqual(toggleGroup(officialIds, "official", options), []);
  assert.deepEqual(toggleGroup(["hacker-news"], "official", options), [...officialIds, "hacker-news"]);
  // Selecting the second group completely selects everything: back to no filter.
  assert.deepEqual(toggleGroup(officialIds, "community", options), []);
});

test("triggerLabel follows the label table", () => {
  assert.equal(triggerLabel([], options, labels), "Mọi nguồn");
  assert.equal(triggerLabel(["anthropic"], options, labels), "Anthropic");
  assert.equal(triggerLabel(["anthropic", "openai"], options, labels), "Anthropic +1");
  assert.equal(triggerLabel(["anthropic", "hacker-news", "google"], options, labels), "Anthropic +2");
  assert.equal(triggerLabel(officialIds, options, labels), "Tất cả chính thức");
  assert.equal(triggerLabel(communityIds, options, labels), "Cộng đồng & báo chí");
  assert.equal(triggerLabel(["hacker-news"], options, labels), "Hacker News");
});

test("selectionChips: one per option, a whole group collapses", () => {
  assert.deepEqual(
    selectionChips(["anthropic", "openai"], options, labels).map((c) => c.label),
    ["Anthropic", "OpenAI"]
  );
  const whole = selectionChips([...officialIds, "hacker-news"], options, labels);
  assert.deepEqual(whole.map((c) => c.label), ["Tất cả chính thức", "Hacker News"]);
  assert.deepEqual(whole[0].ids, officialIds);
  assert.deepEqual(removeIds([...officialIds, "hacker-news"], whole[0].ids, options), ["hacker-news"]);
});

test("URL wins over storage, unknown ids are dropped, empty stays empty", () => {
  assert.deepEqual(resolveSources("openai", ["anthropic"], options), { sources: ["openai"], fromUrl: true });
  assert.deepEqual(resolveSources(null, ["anthropic", "nope"], options), { sources: ["anthropic"], fromUrl: false });
  assert.deepEqual(resolveSources("nope,zzz", ["anthropic"], options), { sources: [], fromUrl: true });
  assert.deepEqual(resolveSources("", ["anthropic"], options), { sources: [], fromUrl: true });
  assert.deepEqual(resolveSources(null, [], options), { sources: [], fromUrl: false });
  assert.deepEqual(resolveSources(null, [...officialIds, ...communityIds], options), { sources: [], fromUrl: false });
});

test("sources param round-trips", () => {
  assert.deepEqual(parseSourcesParam(null), null);
  assert.deepEqual(parseSourcesParam("a, b,,c"), ["a", "b", "c"]);
  assert.equal(sourcesParam(["anthropic", "openai"]), "anthropic,openai");
  assert.deepEqual(parseStoredSources('["a",1,"b"]'), ["a", "b"]);
  assert.deepEqual(parseStoredSources('{"a":1}'), []);
  assert.throws(() => parseStoredSources("not json"));
});
