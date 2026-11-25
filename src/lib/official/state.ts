import { getHashAll, setHashFields } from "@/lib/redis";
import { slugify } from "@/lib/slug";
import type { FetchSourceResult } from "@/lib/types";
import { coerceHealth, sortHealthRows, updateHealth, type SourceHealth } from "@/lib/official/health";
import { OFFICIAL_REPOS, OFFICIAL_SOURCES } from "@/lib/official/sources";
import { coerceValidator, type SourceValidator } from "@/lib/official/validators";

// Redis side of the official sources' bookkeeping: conditional-GET
// validators and per-source health. Server-only (never import from client
// components).
const VALIDATORS_KEY = "wire:http:validators";
const HEALTH_KEY = "wire:sourceHealth";

// sourceId of a watched official repo's releases.
export const OFFICIAL_RELEASE_SOURCE_IDS: ReadonlySet<string> = new Set(
  Object.keys(OFFICIAL_REPOS).map((repo) => slugify(`${repo}-releases`))
);

export async function loadValidators(): Promise<Map<string, SourceValidator>> {
  const raw = await getHashAll<unknown>(VALIDATORS_KEY);
  const out = new Map<string, SourceValidator>();
  for (const [sourceId, value] of raw) {
    const validator = coerceValidator(value);
    if (validator) out.set(sourceId, validator);
  }
  return out;
}

async function loadHealth(): Promise<Map<string, SourceHealth>> {
  const raw = await getHashAll<unknown>(HEALTH_KEY);
  const out = new Map<string, SourceHealth>();
  for (const [sourceId, value] of raw) {
    const health = coerceHealth(value);
    if (health) out.set(sourceId, health);
  }
  return out;
}

// Called once at the end of a fetch cycle with the results of the official
// sources (feeds, parsed pages and official repos' releases). Stores the
// validators of the sources that answered 200 and folds every result into
// its health record.
export async function recordOfficialOutcome(
  results: FetchSourceResult[],
  now: number,
  // False when the item merge did not succeed: the validators must then stay
  // unsaved, or the next run would answer 304 for items that were never stored.
  persistValidators: boolean
): Promise<void> {
  if (results.length === 0) return;
  const validators: Record<string, SourceValidator> = {};
  if (persistValidators) {
    for (const result of results) {
      if (result.ok && result.validator) validators[result.sourceId] = result.validator;
    }
  }
  const previous = await loadHealth();
  const health: Record<string, SourceHealth> = {};
  for (const result of results) {
    health[result.sourceId] = updateHealth(
      previous.get(result.sourceId),
      {
        label: result.label,
        ok: result.ok,
        count: result.items.length,
        parsed: result.parsed,
        notModified: result.notModified,
        error: result.error,
      },
      now
    );
  }
  await Promise.all([setHashFields(VALIDATORS_KEY, validators), setHashFields(HEALTH_KEY, health)]);
}

export type OfficialHealthRow = {
  id: string;
  name: string;
  publisher: string;
  format: string;
  // Absent until the source has run once.
  health: SourceHealth | null;
};

// Every official source that is switched on, with its health, failing first.
// Sources switched off in Settings are not fetched, so their (stale) health
// is left out.
export async function getOfficialHealthRows(disabledFeeds: string[]): Promise<OfficialHealthRow[]> {
  const disabled = new Set(disabledFeeds);
  const health = await loadHealth();
  const rows: OfficialHealthRow[] = [
    ...OFFICIAL_SOURCES.map((source) => ({
      id: source.id,
      name: source.name,
      publisher: source.publisher,
      format: source.format,
    })),
    ...Object.entries(OFFICIAL_REPOS).map(([repo, info]) => ({
      id: slugify(`${repo}-releases`),
      name: `${repo} releases`,
      publisher: info.publisher,
      format: "github-releases",
    })),
  ]
    .filter((row) => !disabled.has(row.id))
    .map((row) => ({ ...row, health: health.get(row.id) ?? null }));
  return sortHealthRows(rows);
}
