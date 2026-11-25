// Pure selection rules for official sources and retention. No imports, so
// they run under `node --test`.

const DAY_MS = 24 * 60 * 60 * 1000;

// dateApprox "month": publishedAt is the 1st of a month the source gave no
// day for (xAI release notes).
export type Dated = { publishedAt?: string; dateApprox?: "month" };

// When an entry counts as published for the lookback cut. An exact date is
// itself; a month-only entry is measured at the end of its month (capped at
// now), so a November entry survives a 14-day lookback until mid-December
// instead of vanishing on the 15th of November.
function effectiveTime(entry: Dated, now: number): number {
  const time = entry.publishedAt ? Date.parse(entry.publishedAt) : NaN;
  if (!Number.isFinite(time) || entry.dateApprox !== "month") return time;
  const d = new Date(time);
  const endOfMonth = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
  return Math.min(endOfMonth, now);
}

// Cuts an entry list by publish date and count: drops undated entries and
// anything older than the lookback (see effectiveTime), newest first, at
// most `limit`.
export function selectRecent<T extends Dated>(
  entries: T[],
  opts: { now: number; lookbackDays: number; limit: number }
): T[] {
  const cutoff = opts.now - opts.lookbackDays * DAY_MS;
  return entries
    .map((entry) => ({ entry, time: effectiveTime(entry, opts.now) }))
    .filter(({ time }) => Number.isFinite(time) && time >= cutoff)
    .sort((a, b) => b.time - a.time)
    .slice(0, Math.max(0, opts.limit))
    .map(({ entry }) => entry);
}

// "" in `allowed` stands for "no category".
export function categoryAllowed(categories: string[], allowed: string[] | undefined): boolean {
  if (!allowed) return true;
  const wanted = new Set(allowed.map((c) => c.toLowerCase()));
  if (categories.length === 0) return wanted.has("");
  return categories.some((c) => wanted.has(c.trim().toLowerCase()));
}

export function hostAllowed(url: string, hosts: readonly string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return hosts.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

// GitHub lists prereleases and drafts (alphas, nightlies) alongside stable
// releases, so a small per_page can return nothing but noise. The caller
// fetches a larger page and this keeps the first `limit` stable ones.
export function selectStableReleases<T extends { prerelease?: boolean; draft?: boolean }>(
  releases: T[],
  limit: number
): T[] {
  return releases.filter((r) => !r.prerelease && !r.draft).slice(0, Math.max(0, limit));
}

// Official repos are always fetched and shown; the saved watched list only
// controls the community ones.
export function withOfficialRepos(watched: string[], official: string[]): string[] {
  return Array.from(new Set([...official, ...watched]));
}

export type RetentionDays = {
  retentionDays: number;
  officialRetentionDays: number;
  // The official lookback: an official item must outlive it, or a 304 (which
  // returns no items) would let it expire inside the window and come back
  // later as "new".
  officialLookbackDays?: number;
};

// An item that is an official product update lives `officialRetentionDays`.
// An official item without a kind (Groq said "none", or Groq has not run
// yet) lives `retentionDays`, but never less than the lookback. Everything
// else lives `retentionDays`.
export function retentionDaysFor(
  item: { official?: { kind?: string } },
  days: RetentionDays
): number {
  if (!item.official) return days.retentionDays;
  const lookback = days.officialLookbackDays ?? 0;
  return item.official.kind
    ? Math.max(days.officialRetentionDays, lookback)
    : Math.max(days.retentionDays, lookback);
}

export function isWithinRetention(firstSeenAt: number, now: number, days: number): boolean {
  return now - firstSeenAt < days * DAY_MS;
}
