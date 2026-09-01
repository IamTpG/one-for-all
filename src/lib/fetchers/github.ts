import { marked } from "marked";
import type { FeedItem } from "@/lib/types";
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
};

type GithubRelease = {
  id: number;
  name: string | null;
  tag_name: string;
  html_url: string;
  body: string | null;
  published_at: string | null;
};

// GitHub has no official "trending" API, so this approximates it with repos
// created in the last week sorted by stars.
export async function fetchGithubTrending(limit: number): Promise<FeedItem[]> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const res = await fetch(
      `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=${limit}`,
      { headers: githubHeaders(), cache: "no-store" }
    );
    await assertGithubOk(res, "GitHub search API");
    const data: { items: GithubRepo[] } = await res.json();

    return data.items.map((repo) => ({
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
  } catch (err) {
    console.error("[github] failed to fetch trending repos:", err);
    return [];
  }
}

async function fetchReleasesForRepo(repo: string, limit: number): Promise<FeedItem[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/releases?per_page=${limit}`,
      { headers: githubHeaders(), cache: "no-store" }
    );
    await assertGithubOk(res, `GitHub releases API (${repo})`);
    const releases: GithubRelease[] = await res.json();

    return releases.map((release) => {
      const body = (release.body ?? "").trim();
      return {
        id: `gh-release:${repo}:${release.id}`,
        source: `${repo} releases`,
        sourceId: slugify(`${repo}-releases`),
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
  } catch (err) {
    console.error(`[github] failed to fetch releases for ${repo}:`, err);
    return [];
  }
}

export async function fetchGithubReleases(repos: string[], perRepoLimit: number): Promise<FeedItem[]> {
  const results = await Promise.all(repos.map((repo) => fetchReleasesForRepo(repo, perRepoLimit)));
  return results.flat();
}
