import { AI_CONTEXT_TERMS, TOPICS } from "@/lib/config";
import type { FeedItem } from "@/lib/types";

// Normalize hyphens/underscores/slashes to spaces so "claude-code" (as it
// appears in repo names/titles) matches a "claude code" keyword and vice
// versa, and collapse whitespace so multi-word keywords match reliably.
function normalize(text: string): string {
  return text.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One regex per keyword list: each keyword must start on a word boundary
// and, unless it ends in "*", end on one too ("prompt" no longer matches
// "promptly"). Boundaries are written out instead of \b so a keyword can
// itself contain non-word characters.
function buildMatcher(keywords: string[]): RegExp {
  const alternatives = keywords.map((keyword) => {
    const normalized = normalize(keyword);
    const isPrefix = normalized.endsWith("*");
    const body = escapeRegex(isPrefix ? normalized.slice(0, -1) : normalized);
    return isPrefix ? body : `${body}(?![a-z0-9])`;
  });
  return new RegExp(`(?<![a-z0-9])(?:${alternatives.join("|")})`);
}

const AI_CONTEXT = buildMatcher(AI_CONTEXT_TERMS);
const TOPIC_MATCHERS = TOPICS.map((topic) => ({ id: topic.id, matcher: buildMatcher(topic.keywords) }));

// Repo names/descriptions are terse ("browser-agent", "claude-skills"), and
// in a new repo "agent" almost always means an AI agent — so repos also
// count as AI-related on these.
const REPO_AI_TERMS = buildMatcher(["agent*", "skills", "prompt*"]);

export function hasAiContext(text: string, { repo = false }: { repo?: boolean } = {}): boolean {
  const normalized = normalize(text);
  return AI_CONTEXT.test(normalized) || (repo && REPO_AI_TERMS.test(normalized));
}

export function matchKeywordTopics(text: string): string[] {
  const normalized = normalize(text);
  if (!AI_CONTEXT.test(normalized)) return [];
  return TOPIC_MATCHERS.filter(({ matcher }) => matcher.test(normalized)).map(({ id }) => id);
}

// Items with no topic are off-topic: hidden from the default feed, still
// reachable through the "Off-topic" filter. Client-safe (no server imports).
export const OFF_TOPIC = "off-topic";
export function isOnTopic(item: Pick<FeedItem, "topics">): boolean {
  return (item.topics?.length ?? 0) > 0;
}

// Topics implied by where an item came from, independent of its text:
// releases only exist for the watched repos, which are AI dev tools by
// definition, and trending repos are already narrowed to AI-related ones by
// the fetcher, so both are always on-topic.
export function sourceTopics(item: Pick<FeedItem, "sourceType">): string[] {
  if (item.sourceType === "github-release") return ["ai-tools", "ai-updates"];
  if (item.sourceType === "github-trending") return ["ai-tools"];
  return [];
}
