import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertGithubOk, githubHeaders } from "@/lib/fetchers/github";
import { isOwnerRequest, OWNER_COOKIE_NAME } from "@/lib/ownerAuth";

export type RepoSearchResult = {
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
};

type GithubRepo = {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
};

export async function GET(request: NextRequest) {
  // This powers an owner-only feature (the watched-repos editor) but is a
  // public URL, so it's gated the same way the settings mutations are —
  // otherwise anyone could spend this app's shared GitHub API rate limit.
  const cookieStore = await cookies();
  if (!isOwnerRequest(cookieStore.get(OWNER_COOKIE_NAME)?.value)) {
    return NextResponse.json({ items: [] });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+in:name&sort=stars&order=desc&per_page=10`,
      { headers: githubHeaders(), cache: "no-store" }
    );
    await assertGithubOk(res, "GitHub search API");
    const data: { items: GithubRepo[] } = await res.json();

    const items: RepoSearchResult[] = data.items.map((repo) => ({
      fullName: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      stars: repo.stargazers_count,
    }));
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[repos/search] failed:", err);
    return NextResponse.json({ items: [] });
  }
}
