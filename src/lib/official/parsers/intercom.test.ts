import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseIntercomNotes } from "./intercom.ts";

const read = (name: string) => readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), "utf8");
const CLAUDE_URL = "https://support.claude.com/en/articles/12138966-release-notes";
const CHATGPT_URL = "https://help.openai.com/en/articles/6825453-chatgpt-release-notes";
const MODELS_URL = "https://help.openai.com/en/articles/9624314-model-release-notes";

test("Claude apps notes: one dated entry per bold title, linked to the date heading", () => {
  const entries = parseIntercomNotes(read("intercom-claude-apps.html"), { pageUrl: CLAUDE_URL });
  assert.equal(entries.length, 13);
  assert.equal(new Set(entries.map((e) => e.key)).size, 13);

  const first = entries[0];
  assert.equal(first.title, "Monthly recap is out of beta");
  assert.equal(first.publishedAt, "2026-11-24T00:00:00.000Z");
  assert.equal(first.key, "2026-11-24-monthly-recap-is-out-of-beta");
  assert.equal(first.url, `${CLAUDE_URL}#h_21ad83d886`);

  // Three entries share one date heading, so one anchor.
  assert.equal(entries.filter((e) => e.publishedAt?.startsWith("2026-11-24")).length, 3);
  // Month group headings ("November 2026") are not entries.
  assert.ok(!entries.some((e) => /^[A-Za-z]+ 2026$/.test(e.title)));
  // Empty spacer paragraphs are not body.
  assert.ok(!first.body?.includes("<p> </p>"));
});

test("Claude apps notes: the Cowork-in-every-conversation entry is its own dated row", () => {
  const entries = parseIntercomNotes(read("intercom-claude-apps.html"), { pageUrl: CLAUDE_URL });
  const cowork = entries.find((e) => e.title === "Claude Cowork comes to every conversation");
  assert.ok(cowork);
  assert.equal(cowork.publishedAt, "2026-09-16T00:00:00.000Z");
  assert.equal(cowork.url, `${CLAUDE_URL}#h_92ef318884`);
  assert.match(cowork.body ?? "", /Claude Cowork does/);
  // The next entry on the same day is separate.
  assert.ok(entries.some((e) => e.title === "Create designs, decks, and docs in any conversation"));
});

test("parsing twice gives identical keys, urls and dates", () => {
  const a = parseIntercomNotes(read("intercom-claude-apps.html"), { pageUrl: CLAUDE_URL });
  const b = parseIntercomNotes(read("intercom-claude-apps.html"), { pageUrl: CLAUDE_URL });
  assert.deepEqual(a, b);
});

test("ChatGPT notes: h2 titles start entries and bold sub-headings stay in the body", () => {
  const entries = parseIntercomNotes(read("intercom-chatgpt.html"), { pageUrl: CHATGPT_URL });
  assert.equal(entries.length, 6);
  assert.deepEqual(
    entries.map((e) => e.publishedAt?.slice(0, 10)),
    ["2026-11-23", "2026-11-20", "2026-11-19", "2026-11-19", "2026-11-18", "2026-11-18"]
  );
  const gpt = entries[0];
  assert.equal(gpt.title, "GPT-6.2, now in the chat tab");
  assert.match(gpt.body ?? "", /Better at understanding images and following instructions/);
  // No heading ids on this page: entries link to the page itself.
  assert.equal(gpt.url, CHATGPT_URL);
  // Images are dropped (text-first rows).
  assert.ok(!/<img/i.test(gpt.body ?? ""));
});

test("Model release notes: dated entries with absolute links", () => {
  const entries = parseIntercomNotes(read("intercom-openai-models.html"), { pageUrl: MODELS_URL });
  assert.equal(entries.length, 4);
  assert.equal(entries[1].title, "GPT-6.2 Astra and GPT-6.2 Sol in the OpenAI API");
  assert.equal(entries[3].publishedAt, "2026-10-30T00:00:00.000Z");
  assert.match(entries[1].body ?? "", /href="https:\/\/openai\.com\/index\/introducing-gpt-6-2-astra-sol\/"/);
});

test("relative links in a body become absolute against the page", () => {
  const html = `<article><h1>Release notes</h1><h2>May 1, 2026</h2><h2>New thing</h2><p>See <a href="/en/articles/1-x">this</a>.</p></article>`;
  const [entry] = parseIntercomNotes(html, { pageUrl: MODELS_URL });
  assert.match(entry.body ?? "", /href="https:\/\/help\.openai\.com\/en\/articles\/1-x"/);
});

test("a page whose date headings are gone parses to zero entries", () => {
  const broken = read("intercom-claude-apps.html").replace(/<h3\b/g, "<div").replace(/<\/h3>/g, "</div>");
  assert.equal(parseIntercomNotes(broken, { pageUrl: CLAUDE_URL }).length, 0);
  assert.equal(parseIntercomNotes("<html><body><p>Access denied</p></body></html>", { pageUrl: CLAUDE_URL }).length, 0);
});
