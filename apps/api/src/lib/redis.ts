import { Redis } from "ioredis";

/**
 * Klien Redis api (rate limit, cache). `enableOfflineQueue: false`: perintah langsung gagal saat Redis mati
 * alih-alih menumpuk — rate limiter lalu memakai limiter cadangan in-memory, readiness melapor 503.
 */
export function createRedis(url: string): Redis {
  return new Redis(url, { enableOfflineQueue: false, maxRetriesPerRequest: 1, lazyConnect: false });
}

/** Tunggu koneksi siap (maks `timeoutMs`); `false` bila Redis tidak terjangkau — pemanggil tetap lanjut. */
export function waitForRedis(redis: Redis, timeoutMs: number): Promise<boolean> {
  if (redis.status === "ready") return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      redis.off("ready", onReady);
      resolve(false);
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve(true);
    };
    redis.once("ready", onReady);
  });
}

export type { Redis };
