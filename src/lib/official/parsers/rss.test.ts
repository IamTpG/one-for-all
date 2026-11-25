import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { categoryAllowed, hostAllowed, selectRecent } from "../filters.ts";
import { resolveKind } from "../kind.ts";
import { parseOfficialRss } from "./rss.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), "utf8");
const now = Date.parse("2026-11-25T06:00:00Z");

test("Claude Platform feed: stable keys, dates, HTML body", async () => {
  const entries = await parseOfficialRss(fixture("platform-rn.xml"));
  assert.ok(entries.length >= 10);
  assert.equal(new Set(entries.map((e) => e.key)).size, entries.length, "keys are unique");
  for (const e of entries) {
    assert.ok(e.key.startsWith("https://platform.claude.com/docs/en/release-notes/overview#"), e.key);
    assert.ok(e.publishedAt, e.key);
    assert.match(e.body ?? "", /<(ul|li|p)\b/);
  }
  // titles are generic and repeat; the key, not the title, identifies an entry
  assert.ok(new Set(entries.map((e) => e.title)).size < entries.length);
  const again = await parseOfficialRss(fixture("platform-rn.xml"));
  assert.deepEqual(again.map((e) => e.key), entries.map((e) => e.key));
});

test("lookback and limit cut a feed that still lists old history", async () => {
  const entries = await parseOfficialRss(fixture("platform-rn.xml"));
  assert.ok(entries.some((e) => e.publishedAt! < "2025-01-01"), "fixture reaches back to 2024");
  const kept = selectRecent(entries, { now, lookbackDays: 14, limit: 6 });
  assert.ok(kept.length > 0 && kept.length <= 6);
  for (const e of kept) assert.ok(Date.parse(e.publishedAt!) >= now - 14 * 86_400_000);
});

test("Codex changelog: CLI releases are tool-release, markdown bodies survive", async () => {
  const entries = await parseOfficialRss(fixture("codex-changelog.xml"));
  const rules = [{ titlePattern: "^Codex CLI Release:", kind: "tool-release" as const }];
  const cli = entries.filter((e) => e.title.startsWith("Codex CLI Release:"));
  assert.ok(cli.length > 0);
  for (const e of cli) {
    assert.equal(resolveKind({ title: e.title, body: e.body, sourceClass: "changelog", rules }).kind, "tool-release");
  }
  const app = entries.find((e) => e.title === "Codex app");
  assert.ok(app?.body?.startsWith("#"), "markdown body kept as shipped");
  for (const e of entries) {
    assert.ok(hostAllowed(e.url, ["developers.openai.com", "learn.chatgpt.com"]) , e.url);
  }
});

test("OpenAI News: category allow-list and /business/ exclusion", async () => {
  const entries = await parseOfficialRss(fixture("openai-news.xml"));
  const allowed = ["Product", "Company", "Research", "Engineering", ""];
  const kept = entries.filter(
    (e) => categoryAllowed(e.categories, allowed) && !e.url.includes("/business/")
  );
  assert.ok(kept.length > 0 && kept.length < entries.length);
  for (const e of kept) {
    assert.ok(!e.url.includes("/business/"), e.url);
    assert.ok(!e.categories.some((c) => ["Science", "Security", "Startup", "Webinars"].includes(c)), e.title);
  }
  // an uncategorised /index/ post is kept
  assert.ok(kept.some((e) => e.categories.length === 0 && e.url.includes("/index/")));
  assert.ok(entries.every((e) => hostAllowed(e.url, ["openai.com"])));
});

test("DeepMind and Google blogs: launches get a keyword kind, research does not", async () => {
  const deepmind = await parseOfficialRss(fixture("deepmind.xml"));
  const kind = (title: string) =>
    resolveKind({ title: deepmind.find((e) => e.title === title)!.title, sourceClass: "news" }).kind;
  assert.equal(kind("Introducing Gemini 4 Neon"), "model-release");
  assert.equal(kind("Genie 4 is now available"), "model-release");
  assert.equal(
    kind("Finding faster quantum algorithms with agents and formal verification"),
    undefined
  );
  const google = await parseOfficialRss(fixture("google-dev.xml"));
  assert.ok(google.length >= 5 && google.every((e) => e.categories.includes("Developer tools")));
});

test("Claude articles feed has no body but has dates", async () => {
  const entries = await parseOfficialRss(fixture("claude-articles.xml"));
  assert.ok(entries.length >= 5);
  assert.ok(entries.every((e) => e.publishedAt && !e.body));
});

test("a valid feed with no items parses to zero entries (the caller treats that as a failure)", async () => {
  const empty = '<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>';
  assert.deepEqual(await parseOfficialRss(empty), []);
});

test("entries without a link or title are skipped; bad XML rejects", async () => {
  const xml =
    '<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>' +
    "<item><title>No link</title></item><item><link>https://a.example/x</link></item>" +
    "<item><title>Good</title><link>https://a.example/y</link><pubDate>Tue, 24 Nov 2026 00:00:00 GMT</pubDate></item>" +
    "</channel></rss>";
  const entries = await parseOfficialRss(xml);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].publishedAt, "2026-11-24T00:00:00.000Z");
  await assert.rejects(parseOfficialRss("<html><body>not a feed</body></html>"));
});
