import Redis from "ioredis";
import type { AiAnalysis } from "@/lib/types";

const KEY_PREFIX = "wire:analysis:";

let client: Redis | null | undefined;

// undefined = not yet checked, null = disabled (no REDIS_URL, or connect
// failed), Redis = ready. AI features treat null the same as "not
// configured" and just skip themselves — this is the one place that
// decides that.
function getClient(): Redis | null {
  if (client !== undefined) return client;

  if (!process.env.REDIS_URL) {
    client = null;
    return client;
  }

  const redis = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  redis.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });
  client = redis;
  return client;
}

export async function getCachedAnalyses(
  ids: string[]
): Promise<Map<string, AiAnalysis>> {
  const results = new Map<string, AiAnalysis>();
  const redis = getClient();
  if (!redis || ids.length === 0) return results;

  try {
    const values = await redis.mget(ids.map((id) => KEY_PREFIX + id));
    ids.forEach((id, i) => {
      const raw = values[i];
      if (!raw) return;
      try {
        results.set(id, JSON.parse(raw) as AiAnalysis);
      } catch {
        // corrupt entry — ignore, treat as a cache miss
      }
    });
  } catch (err) {
    console.error("[redis] failed to read cached analyses:", err);
  }

  return results;
}

export async function setCachedAnalysis(
  id: string,
  analysis: AiAnalysis,
  ttlSeconds: number
): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  try {
    await redis.set(KEY_PREFIX + id, JSON.stringify(analysis), "EX", ttlSeconds);
  } catch (err) {
    console.error(`[redis] failed to cache analysis for ${id}:`, err);
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const redis = getClient();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.error(`[redis] failed to read ${key}:`, err);
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;

  try {
    if (ttlSeconds) {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } else {
      await redis.set(key, JSON.stringify(value));
    }
    return true;
  } catch (err) {
    console.error(`[redis] failed to write ${key}:`, err);
    return false;
  }
}
