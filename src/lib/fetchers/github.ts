import { marked } from "marked";
import { GITHUB_TRENDING_POOL_SIZE } from "@/lib/config";
import { errorMessage } from "@/lib/errors";
import { hasAiContext } from "@/lib/keywordTopics";
import type { FeedItem, FetchSourceResult } from "@/lib/types";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/slug";

// Optional: set GITHUB_TOKEN in .env.local to raise the unauthenticated
// GitHub API rate limit (60 req/hr) if you watch a lot of repos.
export function githubHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

// GitHub exempts this endpoint from every rate limit it reports on — free
// to call as often as needed, so the dashboard can show a live number
// instead of a stale snapshot from whenever a Search API call last happened.
export async function fetchGithubSearchRateLimit(): Promise<{ remaining: number; limit: number } | null> {
  try {
    const res = await fetch("https://api.github.com/rate_limit", {
      headers: githubHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: { resources: { search: { remaining: number; limit: number } } } = await res.json();
    return { remaining: data.resources.search.remaining, limit: data.resources.search.limit };
  } catch (err) {
    console.error("[github] failed to fetch rate limit:", err);
    return null;
  }
}

export async function assertGithubOk(res: Response, what: string): Promise<void> {
  if (res.ok) return;
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (res.status === 403 && remaining === "0") {
    const resetAt = Number(res.headers.get("x-ratelimit-reset") ?? 0) * 1000;
    const resetIn = resetAt ? Math.ceil((resetAt - Date.now()) / 60000) : null;
    throw new Error(
      `GitHub API rate limit exhausted (${what})${resetIn ? `, resets in ~${resetIn}m` : ""}. ` +
        "Set GITHUB_TOKEN in .env.local to raise the limit from 60 to 5,000 req/hr."
    );
  }
  throw new Error(`${what} returned ${res.status}`);
}

type GithubRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  created_at: string;
  topics?: string[];
};

type GithubRelease = {
  id: number;
  name: string | null;
  tag_name: string;
  html_url: string;
  body: string | null;
  published_at: string | null;
};

// Words too common in AI repo names to tell two repos apart.
const GENERIC_NAME_WORDS = new Set([
  "ai", "llm", "llms", "gpt", "mcp", "agent", "agents", "agentic", "claude", "openai", "copilot",
  "awesome", "open", "free", "my", "the", "app", "studio", "hub", "kit", "tool", "tools", "suite",
  "server", "bridge", "lab", "desk", "flow", "forge", "pro", "plus", "demo",
]);

// Spam farms push near-identical repos into the trending list
// (blender-ai-copilot-studio, -flow, -hub, Blender-AI-MCP-Suite, ...). Keep
// only the most-starred repo per name stem: the first word of the repo name
// that isn't a generic AI/tooling word. Input is already sorted by stars.
function dedupeByNameStem(repos: GithubRepo[]): GithubRepo[] {
  const seen = new Set<string>();
  return repos.filter((repo) => {
    const words = (repo.full_name.split("/")[1] ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const stem = words.find((word) => !GENERIC_NAME_WORDS.has(word));
    if (!stem) return true;
    if (seen.has(stem)) return false;
    seen.add(stem);
    return true;
  });
}

// GitHub has no official "trending" API, so this approximates it with repos
// created in the last week sorted by stars. A bigger pool is fetched and
// narrowed to AI-related repos (name, description and GitHub topics) before
// the limit applies — the raw top-by-stars list is mostly unrelated repos.
export async function fetchGithubTrending(limit: number): Promise<FetchSourceResult[]> {
  const sourceId = "github-trending";
  const label = "GitHub Trending";
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const res = await fetch(
      `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=${GITHUB_TRENDING_POOL_SIZE}`,
      { headers: githubHeaders(), cache: "no-store" }
    );
    await assertGithubOk(res, "GitHub search API");
    const data: { items: GithubRepo[] } = await res.json();

    const aiRepos = dedupeByNameStem(
      data.items.filter((repo) =>
        hasAiContext(`${repo.full_name} ${repo.description ?? ""} ${(repo.topics ?? []).join(" ")}`, { repo: true })
      )
    ).slice(0, limit);

    const items: FeedItem[] = aiRepos.map((repo) => ({
      id: `gh-trending:${repo.full_name}`,
      source: "GitHub Trending",
      sourceId: "github-trending",
      sourceType: "github-trending" as const,
      title: repo.full_name,
      url: repo.html_url,
      summary: repo.description ?? undefined,
      points: repo.stargazers_count,
      publishedAt: repo.created_at,
    }));

    return [{ sourceId, label, items, ok: true }];
  } catch (err) {
    console.error("[github] failed to fetch trending repos:", err);
    return [{ sourceId, label, items: [], ok: false, error: errorMessage(err) }];
  }
}

async function fetchReleasesForRepo(repo: string, limit: number): Promise<FetchSourceResult> {
  const sourceId = slugify(`${repo}-releases`);
  const label = `${repo} releases`;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/releases?per_page=${limit}`,
      { headers: githubHeaders(), cache: "no-store" }
    );
    await assertGithubOk(res, `GitHub releases API (${repo})`);
    const releases: GithubRelease[] = await res.json();

    const items: FeedItem[] = releases.map((release) => {
      const body = (release.body ?? "").trim();
      return {
        id: `gh-release:${repo}:${release.id}`,
        source: label,
        sourceId,
        sourceType: "github-release" as const,
        title: `${repo}: ${release.name || release.tag_name}`,
        url: release.html_url,
        tag: release.tag_name,
        summary: body.slice(0, 280),
        fullContentHtml: body
          ? sanitizeArticleHtml(marked.parse(body, { async: false }))
          : undefined,
        publishedAt: release.published_at ?? new Date().toISOString(),
      };
    });
    return { sourceId, label, items, ok: true };
  } catch (err) {
    console.error(`[github] failed to fetch releases for ${repo}:`, err);
    return { sourceId, label, items: [], ok: false, error: errorMessage(err) };
  }
}

export async function fetchGithubReleases(
  repos: string[],
  perRepoLimit: number
): Promise<FetchSourceResult[]> {
  return Promise.all(repos.map((repo) => fetchReleasesForRepo(repo, perRepoLimit)));
}
