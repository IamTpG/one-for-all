import { TOPICS } from "@/lib/config";

export function matchKeywordTopics(text: string): string[] {
  // Normalize hyphens to spaces so "claude-code" (as it appears in repo
  // names/titles) matches a "claude code" keyword and vice versa.
  const normalized = text.toLowerCase().replace(/-/g, " ");
  return TOPICS.filter((topic) =>
    topic.keywords.some((keyword) => normalized.includes(keyword.replace(/-/g, " ")))
  ).map((topic) => topic.id);
}
