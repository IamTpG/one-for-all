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

export async function getHashAll<T>(key: string): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const redis = getClient();
  if (!redis) return results;

  try {
    const raw = await redis.hgetall(key);
    for (const [field, value] of Object.entries(raw)) {
      try {
        results.set(field, JSON.parse(value) as T);
      } catch {
        // corrupt entry — ignore, treat as missing
      }
    }
  } catch (err) {
    console.error(`[redis] failed to read hash ${key}:`, err);
  }

  return results;
}

export async function setHashFields(key: string, fields: Record<string, unknown>): Promise<boolean> {
  const redis = getClient();
  if (!redis || Object.keys(fields).length === 0) return false;

  try {
    const flat: string[] = [];
    for (const [field, value] of Object.entries(fields)) {
      flat.push(field, JSON.stringify(value));
    }
    await redis.hset(key, ...flat);
    return true;
  } catch (err) {
    console.error(`[redis] failed to write hash ${key}:`, err);
    return false;
  }
}

export async function deleteHashFields(key: string, fields: string[]): Promise<boolean> {
  const redis = getClient();
  if (!redis || fields.length === 0) return false;

  try {
    await redis.hdel(key, ...fields);
    return true;
  } catch (err) {
    console.error(`[redis] failed to delete from hash ${key}:`, err);
    return false;
  }
}

// Atomic "claim this slot" check — used so two near-simultaneous cron
// invocations can't both decide a scheduled fetch is due and run it twice.
export async function setIfNotExists(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;

  try {
    const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (err) {
    console.error(`[redis] failed to claim ${key}:`, err);
    return false;
  }
}

// Pushes one entry onto a capped history list — LPUSH+LTRIM in a single
// pipeline so two near-simultaneous writers (a scheduled tick and a manual
// "Fetch now", say) can't race each other the way a getJson/setJson
// read-modify-write on a single array blob could.
export async function pushCapped(key: string, entry: unknown, maxLen: number): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  try {
    await redis.multi().lpush(key, JSON.stringify(entry)).ltrim(key, 0, maxLen - 1).exec();
  } catch (err) {
    console.error(`[redis] failed to push to ${key}:`, err);
  }
}

export async function getCappedList<T>(key: string, count?: number): Promise<T[]> {
  const redis = getClient();
  if (!redis) return [];

  try {
    const raw = await redis.lrange(key, 0, count ? count - 1 : -1);
    return raw.flatMap((entry) => {
      try {
        return [JSON.parse(entry) as T];
      } catch {
        return [];
      }
    });
  } catch (err) {
    console.error(`[redis] failed to read list ${key}:`, err);
    return [];
  }
}

// Atomic counter increment — for view/toggle counts, so concurrent
// increments never read-modify-write and lose a count.
export async function incrHashField(key: string, field: string, by = 1): Promise<number | null> {
  const redis = getClient();
  if (!redis) return null;

  try {
    return await redis.hincrby(key, field, by);
  } catch (err) {
    console.error(`[redis] failed to increment ${key}.${field}:`, err);
    return null;
  }
}

export async function pingRedis(): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;

  try {
    return (await redis.ping()) === "PONG";
  } catch (err) {
    console.error("[redis] ping failed:", err);
    return false;
  }
}
