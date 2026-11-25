// Pure number and list coercion for the settings the owner can change. No
// imports, so it runs under `node --test`.

// A usable limit is a finite number above zero; anything else (NaN, 0,
// negatives, strings, null) falls back.
export function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

// Same rule plus whole numbers only (a limit of 2.5 would end up in a
// per_page query string), never below 1, and clamped to `max`. Used by the
// server actions, which must not trust what the client sent.
export function coerceWholeLimit(value: unknown, fallback: number, max: number = Infinity): number {
  const n = coerceNumber(value, fallback);
  const whole = Math.min(Math.floor(n), max);
  return whole >= 1 ? whole : fallback;
}

// Upper bounds for every owner-editable number.
export const LIMIT_MAX: Record<string, number> = {
  rssItemLimit: 100,
  hnItemLimit: 100,
  githubTrendingLimit: 100,
  releasesPerRepo: 30,
  officialItemLimit: 50,
  officialLookbackDays: 365,
  retentionDays: 365,
  officialRetentionDays: 365,
};

export function coerceWholeLimits<T extends Record<string, number>>(incoming: Partial<Record<keyof T, unknown>>, current: T): T {
  const out = { ...current };
  for (const key of Object.keys(current) as (keyof T)[]) {
    out[key] = coerceWholeLimit(incoming[key], current[key], LIMIT_MAX[key as string]) as T[keyof T];
  }
  return out;
}

// A list of short strings that all match `pattern`, or null when the value is
// anything else (not an array, a non-string, a bad entry, too many entries).
export function cleanStringList(value: unknown, pattern: RegExp, maxItems = 200): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.length > 200 || !pattern.test(entry)) return null;
    out.push(entry);
  }
  return out;
}

export const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
export const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const FETCH_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
