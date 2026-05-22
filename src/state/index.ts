import { FileStateStore } from "./file.js";
import { MemoryStateStore } from "./memory.js";
import type { StateStore } from "./types.js";
import { UpstashRedisStateStore } from "./upstash.js";

export function createStateStore(ttlDays: number): StateStore {
  const driver = process.env.STATE_DRIVER ?? "auto";
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const ttlSeconds = ttlDays * 24 * 60 * 60;

  if ((driver === "auto" || driver === "redis") && redisUrl && redisToken) {
    return new UpstashRedisStateStore(redisUrl, redisToken, ttlSeconds);
  }

  if (driver === "memory") {
    return new MemoryStateStore();
  }

  return new FileStateStore(process.env.STATE_FILE ?? "data/seen-items.json", ttlDays);
}

export type { StateStore } from "./types.js";
