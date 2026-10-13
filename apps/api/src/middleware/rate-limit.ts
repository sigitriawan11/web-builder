import { AppError } from "@platform/shared";
import type { Request, RequestHandler } from "express";
import type { Redis } from "ioredis";
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";

// Middleware 9 (ARCHITECTURE §5.3, §9.6): rate limit Redis per router. Satu policy bisa punya beberapa jendela
// (mis. 10/menit DAN 50/jam). Melebihi → AppError RATE_LIMITED + `retryAfterSeconds` (errorHandler menulis
// header `Retry-After`). Redis mati → limiter cadangan in-memory per proses, sehingga API tidak terbuka tanpa batas.

export interface RateWindow {
  points: number;
  durationSeconds: number;
}

export interface RateLimitPolicy {
  name: string;
  windows: readonly RateWindow[];
  // Kunci pembatas (userId, IP, IP+email, siteId, …); `null` = request ini tidak dibatasi policy ini.
  key: (req: Request) => string | null;
}

/** Limit awal ARCHITECTURE §9.6 (dapat dikonfigurasi). Kunci per router dipasang saat router dibuat. */
export const RATE_LIMITS = {
  platformApi: [{ points: 300, durationSeconds: 60 }],
  auth: [
    { points: 10, durationSeconds: 60 },
    { points: 50, durationSeconds: 3600 },
  ],
  // Registrasi per IP (spec 08 ACC-255; Turnstile menyusul di form, M4).
  signUp: [
    { points: 3, durationSeconds: 3600 },
    { points: 10, durationSeconds: 86_400 },
  ],
  // Kirim ulang email verifikasi per alamat: cooldown 60 detik, maks 5/jam (ACC-003).
  verificationEmail: [
    { points: 1, durationSeconds: 60 },
    { points: 5, durationSeconds: 3600 },
  ],
  publishFree: [{ points: 10, durationSeconds: 3600 }],
  runtimeFormSubmit: [{ points: 10, durationSeconds: 60 }],
  memberLogin: [
    { points: 5, durationSeconds: 60 },
    { points: 30, durationSeconds: 3600 },
  ],
  webhook: [{ points: 100, durationSeconds: 60 }],
} as const satisfies Record<string, readonly RateWindow[]>;

/** Kunci default: userId bila login (authSession), selain itu IP (dari X-Forwarded-For via `trust proxy`). */
export const byUserOrIp = (req: Request): string =>
  req.ctx.user ? `user:${req.ctx.user.id}` : `ip:${req.ip ?? "unknown"}`;

export function rateLimit(redis: Redis, policy: RateLimitPolicy, options: { keyPrefix?: string } = {}): RequestHandler {
  const limiters = policy.windows.map((window) => {
    const keyPrefix = `${options.keyPrefix ?? "rl"}:${policy.name}:${window.durationSeconds}`;
    return new RateLimiterRedis({
      storeClient: redis,
      keyPrefix,
      points: window.points,
      duration: window.durationSeconds,
      insuranceLimiter: new RateLimiterMemory({ keyPrefix, points: window.points, duration: window.durationSeconds }),
    });
  });

  return async (req, _res, next) => {
    const key = policy.key(req);
    if (key === null) return next();
    try {
      for (const limiter of limiters) await limiter.consume(key);
      next();
    } catch (error) {
      if (!(error instanceof RateLimiterRes)) throw error;
      throw new AppError("RATE_LIMITED", undefined, {
        retryAfterSeconds: Math.max(1, Math.ceil(error.msBeforeNext / 1000)),
      });
    }
  };
}
