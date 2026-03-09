import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

type StoredSecret = {
  ciphertext: string;
  iv: string;
  salt: string;
  createdAt: number;
  expiresAt: number;
};

const localStore = new Map<string, StoredSecret>();

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildSecretKey(id: string, token: string) {
  return `secret:${id}:${hashToken(token)}`;
}

function getRedis() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({
    url,
    token,
    enableTelemetry: false
  });
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, record] of localStore.entries()) {
    if (record.expiresAt <= now) {
      localStore.delete(key);
    }
  }
}

export async function createSecret(input: {
  ciphertext: string;
  iv: string;
  salt: string;
  ttlSeconds: number;
}) {
  const id = randomUUID().replaceAll("-", "");
  const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  const createdAt = Date.now();
  const expiresAt = createdAt + input.ttlSeconds * 1000;
  const record: StoredSecret = {
    ciphertext: input.ciphertext,
    iv: input.iv,
    salt: input.salt,
    createdAt,
    expiresAt
  };

  const redis = getRedis();
  const key = buildSecretKey(id, token);

  if (redis) {
    await redis.set(key, record, { ex: input.ttlSeconds });
  } else {
    cleanupExpired();
    localStore.set(key, record);
  }

  return { id, token, expiresAt };
}

export async function consumeSecret(id: string, token: string) {
  const redis = getRedis();
  const key = buildSecretKey(id, token);

  if (redis) {
    return await redis.getdel<StoredSecret>(key);
  }

  cleanupExpired();
  const record = localStore.get(key);
  if (!record) {
    return null;
  }

  localStore.delete(key);
  return record;
}
