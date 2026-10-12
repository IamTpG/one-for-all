import type { GroqUsagePoint } from "@/lib/usage";

// Turns the sparse per-minute Groq counters into evenly spaced chart buckets.
// Pure, so it can be exercised without a browser or Redis.

export type RangeKey = "1h" | "6h" | "24h";

// 24h is grouped into 5-minute buckets (1,440 one-minute columns would be
// hairlines); the rate-limit line is scaled by the bucket size to match.
export const GROQ_RANGES: Record<RangeKey, { minutes: number; bucketMinutes: number }> = {
  "1h": { minutes: 60, bucketMinutes: 1 },
  "6h": { minutes: 360, bucketMinutes: 1 },
  "24h": { minutes: 1440, bucketMinutes: 5 },
};

export type GroqBucket = {
  t: number; // start of the bucket, epoch ms
  requests: number;
  input: number;
  output: number;
  limited: number; // 429s
};

export function bucketGroqUsage(
  points: GroqUsagePoint[],
  nowMs: number,
  range: RangeKey
): { buckets: GroqBucket[]; bucketMinutes: number } {
  const { minutes, bucketMinutes } = GROQ_RANGES[range];
  const bucketMs = bucketMinutes * 60_000;
  const count = minutes / bucketMinutes;
  const end = Math.floor(nowMs / bucketMs) * bucketMs;
  const start = end - (count - 1) * bucketMs;

  const buckets: GroqBucket[] = Array.from({ length: count }, (_, i) => ({
    t: start + i * bucketMs,
    requests: 0,
    input: 0,
    output: 0,
    limited: 0,
  }));

  for (const p of points) {
    const idx = Math.floor((p.t - start) / bucketMs);
    if (idx < 0 || idx >= count) continue;
    buckets[idx].requests += p.req;
    buckets[idx].input += p.input;
    buckets[idx].output += p.output;
    buckets[idx].limited += p.limited;
  }
  return { buckets, bucketMinutes };
}
