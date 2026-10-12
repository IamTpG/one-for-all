import { GROQ_USAGE_RETENTION_DAYS } from "@/lib/config";
import { getHashAll, getJson, incrHashFields, setJson } from "@/lib/redis";

// Groq has no usage API, so the app counts its own calls: one Redis hash per
// UTC day, with a few counters per minute that saw activity. Only minutes
// with at least one call have fields, so a quiet day costs almost nothing.
//   field "HHMM:req" / "HHMM:in" / "HHMM:out" / "HHMM:429"
const MINUTE_KEY_PREFIX = "wire:groq:min:";
const RATE_SNAPSHOT_KEY = "wire:groq:rate";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function minuteField(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// Called for every 429 Groq returns (including ones the retry then recovers
// from). Rate-limited responses carry no usage, so they never show up in
// the request counter — this is the only trace they leave. Never throws.
export async function recordGroq429(): Promise<void> {
  try {
    const now = Date.now();
    await incrHashFields(
      MINUTE_KEY_PREFIX + dayKey(now),
      { [`${minuteField(now)}:429`]: 1 },
      GROQ_USAGE_RETENTION_DAYS * 24 * 60 * 60
    );
  } catch (err) {
    console.error("[usage] failed to record Groq 429:", err);
  }
}

export type GroqRateSnapshot = {
  ts: number;
  remainingRequests: number | null; // daily (RPD)
  remainingTokens: number | null; // per minute (TPM)
};

function headerNumber(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Called after every Groq completion. Never throws — a failed bookkeeping
// write must not turn a successful AI call into a failure.
export async function recordGroqCall(
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
  headers: Headers
): Promise<void> {
  try {
    const now = Date.now();
    const minute = minuteField(now);
    await Promise.all([
      incrHashFields(
        MINUTE_KEY_PREFIX + dayKey(now),
        {
          [`${minute}:req`]: 1,
          [`${minute}:in`]: usage?.prompt_tokens ?? 0,
          [`${minute}:out`]: usage?.completion_tokens ?? 0,
        },
        GROQ_USAGE_RETENTION_DAYS * 24 * 60 * 60
      ),
      setJson(RATE_SNAPSHOT_KEY, {
        ts: now,
        remainingRequests: headerNumber(headers, "x-ratelimit-remaining-requests"),
        remainingTokens: headerNumber(headers, "x-ratelimit-remaining-tokens"),
      } satisfies GroqRateSnapshot),
    ]);
  } catch (err) {
    console.error("[usage] failed to record Groq call:", err);
  }
}

export type GroqUsagePoint = { t: number; req: number; input: number; output: number; limited: number };

export type GroqUsage = {
  nowMs: number;
  // Sparse: only minutes (start-of-minute epoch ms) in the last 24h with activity.
  points: GroqUsagePoint[];
  // Totals for the current UTC day.
  today: { requests: number; tokens: number; rateLimited: number };
  rate: GroqRateSnapshot | null;
};

export async function getGroqUsage(): Promise<GroqUsage> {
  const nowMs = Date.now();
  const since = nowMs - ONE_DAY_MS;
  const todayKey = dayKey(nowMs);
  const yesterdayKey = dayKey(nowMs - ONE_DAY_MS);

  const [todayHash, yesterdayHash, rate] = await Promise.all([
    getHashAll<number>(MINUTE_KEY_PREFIX + todayKey),
    getHashAll<number>(MINUTE_KEY_PREFIX + yesterdayKey),
    getJson<GroqRateSnapshot>(RATE_SNAPSHOT_KEY),
  ]);

  const byMinute = new Map<number, GroqUsagePoint>();
  let todayRequests = 0;
  let todayTokens = 0;
  let todayRateLimited = 0;

  for (const [date, hash] of [
    [yesterdayKey, yesterdayHash],
    [todayKey, todayHash],
  ] as const) {
    for (const [field, value] of hash) {
      const [hhmm, kind] = field.split(":");
      const t = Date.parse(`${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`);
      if (!Number.isFinite(t)) continue;

      if (date === todayKey) {
        if (kind === "req") todayRequests += value;
        else if (kind === "in" || kind === "out") todayTokens += value;
        else if (kind === "429") todayRateLimited += value;
      }
      if (t < since || t > nowMs) continue;

      const point = byMinute.get(t) ?? { t, req: 0, input: 0, output: 0, limited: 0 };
      if (kind === "req") point.req = value;
      else if (kind === "in") point.input = value;
      else if (kind === "out") point.output = value;
      else if (kind === "429") point.limited = value;
      byMinute.set(t, point);
    }
  }

  return {
    nowMs,
    points: Array.from(byMinute.values()).sort((a, b) => a.t - b.t),
    today: { requests: todayRequests, tokens: todayTokens, rateLimited: todayRateLimited },
    rate,
  };
}
