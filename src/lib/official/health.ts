// Per-source health for the official sources, updated after every fetch
// cycle (wire:sourceHealth). Pure — no imports — so it runs under
// `node --test`.

export type SourceHealth = {
  label: string;
  // When the source last answered successfully (a 304 counts); null if never.
  lastOkAt: number | null;
  // When it was last attempted.
  lastRunAt: number;
  // Items the last full (non-304) successful run returned.
  lastCount: number;
  consecutiveFailures: number;
  // Successful full runs in a row where the source parsed to no entry at
  // all (before the lookback cut): the layout alarm. A source that is merely
  // quiet (entries older than the lookback) never counts. A 304 neither adds
  // to nor resets this.
  consecutiveZeroRuns: number;
  lastError?: string;
  // The last run was answered 304 (nothing changed).
  lastNotModified?: boolean;
};

export type HealthSample = {
  label: string;
  ok: boolean;
  // Items kept after the lookback cut.
  count: number;
  // Entries the parser found before the cut; undefined when unknown (then
  // it is taken to be `count`).
  parsed?: number;
  notModified?: boolean;
  error?: string;
};

const MAX_ERROR_LENGTH = 300;

export function updateHealth(prev: SourceHealth | undefined, sample: HealthSample, now: number): SourceHealth {
  const base = {
    label: sample.label,
    lastRunAt: now,
  };
  if (!sample.ok) {
    return {
      ...base,
      lastOkAt: prev?.lastOkAt ?? null,
      lastCount: prev?.lastCount ?? 0,
      consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
      consecutiveZeroRuns: prev?.consecutiveZeroRuns ?? 0,
      lastError: (sample.error ?? "Unknown error").slice(0, MAX_ERROR_LENGTH),
    };
  }
  if (sample.notModified) {
    return {
      ...base,
      lastOkAt: now,
      lastCount: prev?.lastCount ?? 0,
      consecutiveFailures: 0,
      consecutiveZeroRuns: prev?.consecutiveZeroRuns ?? 0,
      lastNotModified: true,
    };
  }
  return {
    ...base,
    lastOkAt: now,
    lastCount: sample.count,
    consecutiveFailures: 0,
    consecutiveZeroRuns: (sample.parsed ?? sample.count) === 0 ? (prev?.consecutiveZeroRuns ?? 0) + 1 : 0,
  };
}

// One stored value, read defensively: anything malformed is treated as absent.
export function coerceHealth(raw: unknown): SourceHealth | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  if (typeof r.label !== "string") return null;
  return {
    label: r.label,
    lastOkAt: typeof r.lastOkAt === "number" && Number.isFinite(r.lastOkAt) ? r.lastOkAt : null,
    lastRunAt: typeof r.lastRunAt === "number" && Number.isFinite(r.lastRunAt) ? r.lastRunAt : 0,
    lastCount: int(r.lastCount),
    consecutiveFailures: int(r.consecutiveFailures),
    consecutiveZeroRuns: int(r.consecutiveZeroRuns),
    ...(typeof r.lastError === "string" ? { lastError: r.lastError } : {}),
    ...(r.lastNotModified === true ? { lastNotModified: true } : {}),
  };
}

// A source counts as stuck once it has failed or come back empty this many
// runs in a row.
export const STUCK_STREAK = 3;

export function isStuck(health: Pick<SourceHealth, "consecutiveFailures" | "consecutiveZeroRuns">, streak: number = STUCK_STREAK): boolean {
  return health.consecutiveFailures >= streak || health.consecutiveZeroRuns >= streak;
}

type Sortable = { health?: Pick<SourceHealth, "consecutiveFailures" | "consecutiveZeroRuns" | "lastOkAt"> | null; name: string };

// Failing sources first (longest failure streak first), then empty ones,
// then healthy ones by name; sources that never ran go last.
export function sortHealthRows<T extends Sortable>(rows: T[]): T[] {
  const rank = (row: T): [number, number] => {
    const h = row.health;
    if (!h) return [3, 0];
    if (h.consecutiveFailures > 0) return [0, -h.consecutiveFailures];
    if (h.consecutiveZeroRuns > 0) return [1, -h.consecutiveZeroRuns];
    return [2, 0];
  };
  return [...rows].sort((a, b) => {
    const [ra, sa] = rank(a);
    const [rb, sb] = rank(b);
    return ra - rb || sa - sb || a.name.localeCompare(b.name);
  });
}
