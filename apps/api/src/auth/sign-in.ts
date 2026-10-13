import { AsyncLocalStorage } from "node:async_hooks";
import { isIP } from "node:net";
import { AppError } from "@platform/shared";
import type { Logger } from "@platform/shared/node";
import type { RequestHandler } from "express";
import type { Redis } from "ioredis";
import type { CaptchaVerifier } from "./captcha";

// Login email + password (ACC-004): kegagalan dihitung per pasangan (email, IP) di Redis.
// ≥ 3 gagal → wajib Turnstile (header `x-captcha-response`); ≥ 5 gagal → terkunci 15 menit untuk pasangan itu.
// Hitungan diperbarui hook Better Auth setelah sign-in (berhasil → reset), lewat konteks AsyncLocalStorage.

export const SIGN_IN_FAILURE_WINDOW_SECONDS = 15 * 60;
export const CAPTCHA_AFTER_FAILURES = 3;
export const LOCK_AFTER_FAILURES = 5;
export const CAPTCHA_HEADER = "x-captcha-response";

export interface SignInContext {
  email: string;
  failureKey: string;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<SignInContext>();

export function currentSignIn(): SignInContext | undefined {
  return storage.getStore();
}

const failureKeyFor = (email: string, ip: string | undefined) => `signin-fail:${email}:${ip ?? "unknown"}`;

/** Catat satu kegagalan; jendela 15 menit dihitung dari kegagalan pertama, kunci 15 menit dari kegagalan ke-5. */
export async function recordSignInFailure(redis: Redis, key: string): Promise<number> {
  const failures = await redis.incr(key);
  if (failures === 1 || failures >= LOCK_AFTER_FAILURES) await redis.expire(key, SIGN_IN_FAILURE_WINDOW_SECONDS);
  return failures;
}

export function signInGuard(deps: { redis: Redis; verifyCaptcha: CaptchaVerifier; logger: Logger }): RequestHandler {
  return async (req, _res, next) => {
    const rawEmail: unknown = (req.body as { email?: unknown } | undefined)?.email;
    // Body tidak valid diteruskan apa adanya: Better Auth yang menolak dengan pesan validasinya.
    if (typeof rawEmail !== "string") return next();
    const email = rawEmail.trim().toLowerCase();
    const ip = req.ip && isIP(req.ip) ? req.ip : undefined;
    const failureKey = failureKeyFor(email, ip);

    let failures = 0;
    let ttl = SIGN_IN_FAILURE_WINDOW_SECONDS;
    try {
      [failures, ttl] = await Promise.all([
        deps.redis.get(failureKey).then((value) => Number(value ?? 0)),
        deps.redis.ttl(failureKey),
      ]);
    } catch (error) {
      // Redis mati: lanjut tanpa penguncian per akun (limiter /auth per IP tetap punya cadangan in-memory).
      deps.logger.warn({ err: error }, "penghitung login gagal tidak terbaca");
    }

    if (failures >= LOCK_AFTER_FAILURES) {
      throw new AppError("RATE_LIMITED", undefined, {
        retryAfterSeconds: ttl > 0 ? ttl : SIGN_IN_FAILURE_WINDOW_SECONDS,
      });
    }
    if (failures >= CAPTCHA_AFTER_FAILURES) {
      const token = req.get(CAPTCHA_HEADER);
      if (!token) throw new AppError("CAPTCHA_REQUIRED", undefined, { reason: "missing" });
      if (!(await deps.verifyCaptcha(token, ip))) {
        throw new AppError("CAPTCHA_REQUIRED", undefined, { reason: "invalid" });
      }
    }

    const userAgent = req.get("user-agent");
    storage.run({ email, failureKey, ...(ip ? { ip } : {}), ...(userAgent ? { userAgent } : {}) }, () => next());
  };
}
