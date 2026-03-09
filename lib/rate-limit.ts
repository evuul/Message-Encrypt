import { getRedis } from "@/lib/redis";

type LocalRateRecord = {
  count: number;
  expiresAt: number;
};

const localRateStore = new Map<string, LocalRateRecord>();

function cleanupLocalRateStore(now: number) {
  for (const [key, value] of localRateStore.entries()) {
    if (value.expiresAt <= now) {
      localRateStore.delete(key);
    }
  }
}

export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  const redis = getRedis();

  if (redis) {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current)
    };
  }

  const now = Date.now();
  cleanupLocalRateStore(now);
  const current = localRateStore.get(key);

  if (!current || current.expiresAt <= now) {
    localRateStore.set(key, {
      count: 1,
      expiresAt: now + windowSeconds * 1000
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1)
    };
  }

  current.count += 1;
  localRateStore.set(key, current);

  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count)
  };
}
