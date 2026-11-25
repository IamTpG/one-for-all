// Pure: canonical form of a URL, used to recognise that a community item
// links to an official post. Imports nothing.

// Hosts whose pages are single long changelogs where the #fragment is the
// only thing that tells two entries apart.
export const CHANGELOG_HOSTS: readonly string[] = [
  "platform.claude.com",
  "support.claude.com",
  "help.openai.com",
  "developers.openai.com",
  "learn.chatgpt.com",
  "aistudio.google.com",
  "docs.x.ai",
];

// A canonical URL that points at one entry. A changelog host's bare page
// URL ("help.openai.com/.../chatgpt-release-notes", no #anchor) is shared by
// every entry of that page, so it identifies none of them.
export function isEntryUrl(canonical: string): boolean {
  const url = new URL(canonical);
  return !CHANGELOG_HOSTS.includes(url.hostname) || url.hash.length > 1;
}

const TRACKING_PARAMS = new Set(["ref", "fbclid", "gclid"]);

export function canonicalUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith("utm_") && !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = params.length
    ? "?" + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
    : "";
  const path = url.pathname.replace(/\/+$/, "");
  const hash = CHANGELOG_HOSTS.includes(host) && url.hash.length > 1 ? url.hash : "";
  return `https://${host}${path}${query}${hash}`;
}
