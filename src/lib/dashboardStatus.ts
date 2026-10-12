import { DASHBOARD_THRESHOLDS } from "@/lib/config";

// Turns a handful of already-loaded numbers into the dashboard's status
// banner: one verdict sentence plus a chip per check. Pure on purpose — no
// I/O, `now` passed in — so every threshold is easy to exercise in isolation.

export type CheckLevel = "ok" | "warn" | "bad";

export type StatusCheck = {
  id: string;
  level: CheckLevel;
  // Short chip text, always shown ("Backlog 0", "Cron tick 4m ago").
  label: string;
  // Phrase used in the verdict sentence when the check is not ok.
  problem: string;
};

export type StatusResult = {
  level: CheckLevel;
  verdict: string;
  checks: StatusCheck[];
};

export type StatusInputs = {
  now: number;
  redisUp: boolean;
  // Newest recorded cron tick; null when none has been recorded yet.
  lastTickTs: number | null;
  // Longest of the recent ticks, null when there are none.
  longestTickMs: number | null;
  // The most recent scheduled fetch slot that should already have run
  // (epoch ms of that slot, "HH:MM" ICT label) and whether a run was recorded for it.
  dueSlot: { ts: number; label: string; ran: boolean } | null;
  // Newest fetch run (scheduled or manual); sources = [ok, total] of that run.
  lastRunTs: number | null;
  sourcesFailed: number;
  sourcesTotal: number;
  backlog: number;
  groqTokensPercent: number;
  // null when the Upstash panel is not configured or unavailable.
  upstashBandwidthPercent: number | null;
};

const LEVEL_RANK: Record<CheckLevel, number> = { ok: 0, warn: 1, bad: 2 };

function atLeast(value: number, t: { warn: number; bad: number }): CheckLevel {
  return value >= t.bad ? "bad" : value >= t.warn ? "warn" : "ok";
}

function minutesSince(ts: number, now: number): number {
  return Math.max(0, Math.round((now - ts) / 60000));
}

function ago(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

export function evaluateStatus(input: StatusInputs): StatusResult {
  const T = DASHBOARD_THRESHOLDS;
  const checks: StatusCheck[] = [];

  checks.push({
    id: "redis",
    level: input.redisUp ? "ok" : "bad",
    label: input.redisUp ? "Redis connected" : "Redis unreachable",
    problem: "Redis is unreachable",
  });

  if (input.lastTickTs === null) {
    checks.push({ id: "tick", level: "warn", label: "No cron tick yet", problem: "no cron tick has been recorded yet" });
  } else {
    const age = minutesSince(input.lastTickTs, input.now);
    checks.push({
      id: "tick",
      level: atLeast(age, T.tickAgeMinutes),
      label: `Cron tick ${ago(age)}`,
      problem: `cron is late (last tick ${ago(age)})`,
    });
  }

  if (input.longestTickMs !== null) {
    const seconds = Math.round(input.longestTickMs / 1000);
    checks.push({
      id: "tickDuration",
      level: atLeast(input.longestTickMs, T.tickDurationMs),
      label: `Longest tick ${seconds}s`,
      problem: `a cron tick took ${seconds}s, close to the 60s limit`,
    });
  }

  if (input.dueSlot) {
    const overdue = minutesSince(input.dueSlot.ts, input.now);
    const level: CheckLevel = input.dueSlot.ran ? "ok" : atLeast(overdue, T.fetchOverdueMinutes);
    checks.push({
      id: "fetch",
      level,
      label: input.dueSlot.ran ? `Fetch ${input.dueSlot.label} ok` : `Fetch ${input.dueSlot.label} not run`,
      problem: `the ${input.dueSlot.label} fetch has not run (${ago(overdue)})`,
    });
  }

  if (input.sourcesTotal > 0) {
    const share = input.sourcesFailed / input.sourcesTotal;
    const level: CheckLevel = input.sourcesFailed === 0 ? "ok" : share > T.sourcesFailedShare.bad ? "bad" : "warn";
    checks.push({
      id: "sources",
      level,
      label: `Sources ${input.sourcesTotal - input.sourcesFailed}/${input.sourcesTotal}`,
      problem: `${input.sourcesFailed} of ${input.sourcesTotal} sources failed on the last fetch`,
    });
  }

  const sinceFetch = input.lastRunTs === null ? Infinity : minutesSince(input.lastRunTs, input.now);
  const draining = sinceFetch < T.backlogGraceMinutesAfterFetch;
  checks.push({
    id: "backlog",
    level: draining ? "ok" : atLeast(input.backlog, T.backlogItems),
    label: `Backlog ${input.backlog}`,
    problem: `translation backlog is growing (${input.backlog} items)`,
  });

  checks.push({
    id: "groq",
    level: atLeast(input.groqTokensPercent, T.groqTokensPercent),
    label: `Groq ${Math.round(input.groqTokensPercent)}%`,
    problem: `Groq is at ${Math.round(input.groqTokensPercent)}% of today's tokens`,
  });

  if (input.upstashBandwidthPercent !== null) {
    const pct = input.upstashBandwidthPercent;
    checks.push({
      id: "upstash",
      level: atLeast(pct, T.upstashBandwidthPercent),
      label: `Upstash ${pct < 1 ? pct.toFixed(2) : Math.round(pct)}%`,
      problem: `Upstash bandwidth is heading for ${Math.round(pct)}% of the monthly limit`,
    });
  }

  const level = checks.reduce<CheckLevel>((worst, c) => (LEVEL_RANK[c.level] > LEVEL_RANK[worst] ? c.level : worst), "ok");
  const problems = checks.filter((c) => c.level !== "ok");
  let verdict = "All systems normal";
  if (problems.length > 0) {
    const shown = problems.slice(0, 3).map((c) => c.problem).join(", ");
    const more = problems.length > 3 ? ` (+${problems.length - 3} more)` : "";
    verdict = `${problems.length} ${problems.length === 1 ? "thing needs" : "things need"} attention: ${shown}${more}`;
  }
  return { level, verdict, checks };
}
