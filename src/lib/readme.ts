import { parseHTML } from "linkedom";
import { EXTRACT_CACHE_TTL_MS, FETCH_TIMEOUT_MS } from "@/lib/config";
import { githubHeaders } from "@/lib/fetchers/github";
import { sanitizeArticleHtml } from "@/lib/sanitize";

const cache = new Map<string, { html: string | null; fetchedAt: number }>();

// "owner/name" from a GitHub Trending item id ("gh-trending:owner/name").
export function trendingRepo(itemId: string): string | null {
  const repo = itemId.startsWith("gh-trending:") ? itemId.slice("gh-trending:".length) : "";
  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : null;
}

// The repo's README rendered to HTML by GitHub itself (the API's html media
// type), which is far more reliable than running Readability on the repo
// page. Relative links and images are resolved against the repo, since the
// page they end up on is ours, not GitHub's.
export async function fetchRepoReadme(repo: string): Promise<string | null> {
  const cached = cache.get(repo);
  if (cached && Date.now() - cached.fetchedAt < EXTRACT_CACHE_TTL_MS) return cached.html;

  let html: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`https://api.github.com/repos/${repo}/readme`, {
      headers: { ...githubHeaders(), Accept: "application/vnd.github.html" },
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timer));
    if (res.ok) html = absolutize(await res.text(), repo);
  } catch (err) {
    console.error(`[readme] failed to fetch README for ${repo}:`, err);
  }

  const sanitized = html ? sanitizeArticleHtml(html).trim() || null : null;
  cache.set(repo, { html: sanitized, fetchedAt: Date.now() });
  return sanitized;
}

function absolutize(html: string, repo: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const resolve = (value: string, base: string) => {
    if (!value || value.startsWith("#")) return value;
    try {
      return new URL(value, base).toString();
    } catch {
      return value;
    }
  };
  for (const img of Array.from(document.querySelectorAll("img"))) {
    const src = img.getAttribute("src");
    if (src) img.setAttribute("src", resolve(src, `https://github.com/${repo}/raw/HEAD/`));
  }
  for (const link of Array.from(document.querySelectorAll("a"))) {
    const href = link.getAttribute("href");
    // In-page anchors point at GitHub's own heading ids, which the
    // sanitizer strips; send them to the README on GitHub instead.
    if (href?.startsWith("#")) link.setAttribute("href", `https://github.com/${repo}${href}`);
    else if (href) link.setAttribute("href", resolve(href, `https://github.com/${repo}/blob/HEAD/`));
  }
  // GitHub's heading permalink icons carry no text once their SVG is gone.
  for (const anchor of Array.from(document.querySelectorAll("a.anchor"))) anchor.remove();
  // A README usually opens with the project name as its h1, which would
  // repeat the page's own title right under it. Only an h1 with nothing but
  // badges or images before it counts as that opening title.
  const firstH1 = document.querySelector("h1");
  if (firstH1) {
    const allText = document.body.textContent ?? "";
    const at = allText.indexOf(firstH1.textContent ?? "");
    if (at >= 0 && !allText.slice(0, at).trim()) firstH1.remove();
  }
  return document.body.innerHTML;
}
