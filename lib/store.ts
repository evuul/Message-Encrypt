import { createHash, randomBytes } from "node:crypto";
import { getRedis } from "@/lib/redis";

type StoredSecret = {
  ciphertext: string;
  iv: string;
  salt: string;
  createdAt: number;
  expiresAt: number;
};

const localStore = new Map<string, StoredSecret>();
const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SECRET_ID_LENGTH = 10;
const SECRET_TOKEN_LENGTH = 22;

export class StoreUnavailableError extends Error {
  constructor() {
    super("Säker serverlagring är inte tillgänglig just nu. Försök igen om en liten stund.");
    this.name = "StoreUnavailableError";
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildSecretKey(id: string, token: string) {
  return `secret:${id}:${hashToken(token)}`;
}

function createRandomString(length: number) {
  const bytes = randomBytes(length);
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += ID_ALPHABET[bytes[index] % ID_ALPHABET.length];
  }

  return value;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, record] of localStore.entries()) {
    if (record.expiresAt <= now) {
      localStore.delete(key);
    }
  }
}

function canUseLocalStoreFallback() {
  return process.env.NODE_ENV !== "production";
}

export async function createSecret(input: {
  ciphertext: string;
  iv: string;
  salt: string;
  ttlSeconds: number;
}) {
  const id = createRandomString(SECRET_ID_LENGTH);
  const token = createRandomString(SECRET_TOKEN_LENGTH);
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
  } else if (canUseLocalStoreFallback()) {
    cleanupExpired();
    localStore.set(key, record);
  } else {
    throw new StoreUnavailableError();
  }

  return { id, token, expiresAt };
}

export async function consumeSecret(id: string, token: string) {
  const redis = getRedis();
  const key = buildSecretKey(id, token);

  if (redis) {
    return await redis.getdel<StoredSecret>(key);
  }

  if (!canUseLocalStoreFallback()) {
    throw new StoreUnavailableError();
  }

  cleanupExpired();
  const record = localStore.get(key);
  if (!record) {
    return null;
  }

  localStore.delete(key);
  return record;
}
