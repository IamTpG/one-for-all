import { GROQ_BUDGET_RESERVE, GROQ_LIMITS, GROQ_USAGE_RETENTION_DAYS } from "@/lib/config";
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

// ---------- Circuit breaker ----------

// While this key exists, Groq is not called at all: no request, so no 429.
// Its TTL is the pause length, so it clears itself.
const COOLDOWN_KEY = "wire:groq:cooldown";

export type GroqCooldown = {
  until: number; // epoch ms
  // "retry-after": Groq answered 429 with a long retry-after (daily limit).
  // "daily-budget": our own counters reached the daily limit.
  reason: "retry-after" | "daily-budget";
};

export function nextUtcMidnight(now: number = Date.now()): number {
  return Math.floor(now / ONE_DAY_MS) * ONE_DAY_MS + ONE_DAY_MS;
}

// One cheap GET — safe to call before every Groq request. Fails open: if
// Redis is down, Groq is simply tried.
export async function getGroqCooldown(): Promise<GroqCooldown | null> {
  const cooldown = await getJson<GroqCooldown>(COOLDOWN_KEY);
  return cooldown && cooldown.until > Date.now() ? cooldown : null;
}

export async function setGroqCooldown(until: number, reason: GroqCooldown["reason"]): Promise<void> {
  const ttlSeconds = Math.max(1, Math.ceil((until - Date.now()) / 1000));
  await setJson(COOLDOWN_KEY, { until, reason } satisfies GroqCooldown, ttlSeconds);
}

// Checks today's own counters against the daily limits and, when they are
// (nearly) used up, pauses Groq until the next UTC midnight. Reads the usage
// hashes, so call it once per run (cron tick, page render), not per request.
// Returns the active pause, if any.
export async function enforceGroqBudget(): Promise<GroqCooldown | null> {
  const existing = await getGroqCooldown();
  if (existing) return existing;

  const { today } = await getGroqUsage();
  const spent =
    today.requests >= GROQ_LIMITS.requestsPerDay - GROQ_BUDGET_RESERVE.requests ||
    today.tokens >= GROQ_LIMITS.tokensPerDay - GROQ_BUDGET_RESERVE.tokens;
  if (!spent) return null;

  const until = nextUtcMidnight();
  console.error("[groq] daily budget used up, pausing until next UTC midnight");
  await setGroqCooldown(until, "daily-budget");
  return { until, reason: "daily-budget" };
}
