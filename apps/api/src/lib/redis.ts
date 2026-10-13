import { Redis } from "ioredis";

/**
 * Klien Redis api (rate limit, cache). `enableOfflineQueue: false`: perintah langsung gagal saat Redis mati
 * alih-alih menumpuk — rate limiter lalu memakai limiter cadangan in-memory, readiness melapor 503.
 */
export function createRedis(url: string): Redis {
  return new Redis(url, { enableOfflineQueue: false, maxRetriesPerRequest: 1, lazyConnect: false });
}

export type { Redis };
