// Reads this database's usage from the Upstash Developer API
// (GET /v2/redis/stats/{id}, HTTP Basic: account email + a — preferably
// read-only — API key). Server-only: the key must never reach the client.
// Everything is optional: with the env vars unset the dashboard just hides
// the Upstash section, and any failure becomes an "unavailable" message.

const STATS_URL = "https://api.upstash.com/v2/redis/stats";
const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 8000;

export type DayPoint = { t: number; label: string; value: number };
export type MinutePoint = { t: number; value: number };

export type UpstashUsage = {
  bandwidth: {
    monthBytes: number;
    // Month-to-date usage extrapolated to the end of the month; null in the
    // first day of a month, when the extrapolation is too noisy to mean much.
    projectedMonthBytes: number | null;
    daily: DayPoint[];
  };
  dataSize: { currentBytes: number; series: MinutePoint[] };
  requests: { monthTotal: number; daily: DayPoint[] };
  // Commands per second, averaged over each minute of the last hour.
  throughput: { read: MinutePoint[]; write: MinutePoint[]; latestPerSec: number };
  // Unit is not documented by Upstash (likely milliseconds).
  latency: { mean: MinutePoint[]; p99: MinutePoint[] };
};

export type UpstashUsageResult =
  | { status: "disabled" }
  | { status: "error"; message: string }
  | { status: "ok"; data: UpstashUsage };

type RawPoint = { x?: unknown; y?: unknown };

// "2026-10-11 16:37:00.000 +0000 UTC" (sometimes with 9 fractional digits)
function parseTime(x: unknown): number | null {
  if (typeof x !== "string") return null;
  const m = x.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d+))? \+0000 UTC$/);
  if (!m) return null;
  const ms = (m[3] ?? "").slice(0, 3).padEnd(3, "0");
  const t = Date.parse(`${m[1]}T${m[2]}.${ms}Z`);
  return Number.isFinite(t) ? t : null;
}

function series(raw: unknown): MinutePoint[] {
  if (!Array.isArray(raw)) return [];
  const points: MinutePoint[] = [];
  for (const p of raw as RawPoint[]) {
    const t = parseTime(p?.x);
    const value = Number(p?.y);
    if (t !== null && Number.isFinite(value)) points.push({ t, value });
  }
  return points.sort((a, b) => a.t - b.t);
}

function dayLabel(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function dailySeries(raw: unknown): DayPoint[] {
  return series(raw).map((p) => ({ ...p, label: dayLabel(p.t) }));
}

function finite(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function projectMonth(monthBytes: number, now: Date): number | null {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const elapsed = (now.getTime() - start) / (end - start);
  const oneDay = (24 * 60 * 60 * 1000) / (end - start);
  return elapsed >= oneDay ? monthBytes / elapsed : null;
}

export async function getUpstashUsage(): Promise<UpstashUsageResult> {
  const { UPSTASH_EMAIL: email, UPSTASH_API_KEY: apiKey, UPSTASH_DB_ID: dbId } = process.env;
  if (!email || !apiKey || !dbId) return { status: "disabled" };

  try {
    const res = await fetch(`${STATS_URL}/${encodeURIComponent(dbId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${email}:${apiKey}`).toString("base64")}` },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { status: "error", message: `Upstash API returned ${res.status}` };

    const raw = (await res.json()) as Record<string, unknown>;
    const read = series(raw.read);
    const write = series(raw.write);
    const monthBytes = finite(raw.total_monthly_bandwidth);

    return {
      status: "ok",
      data: {
        bandwidth: {
          monthBytes,
          projectedMonthBytes: projectMonth(monthBytes, new Date()),
          daily: dailySeries(raw.bandwidths),
        },
        dataSize: { currentBytes: finite(raw.current_storage), series: series(raw.diskusage) },
        requests: { monthTotal: finite(raw.total_monthly_requests), daily: dailySeries(raw.dailyrequests) },
        throughput: {
          read,
          write,
          latestPerSec: (read.at(-1)?.value ?? 0) + (write.at(-1)?.value ?? 0),
        },
        latency: { mean: series(raw.latencymean), p99: series(raw.latency_99) },
      },
    };
  } catch (err) {
    console.error("[upstash] failed to load usage:", err);
    return { status: "error", message: "Could not reach the Upstash API" };
  }
}
