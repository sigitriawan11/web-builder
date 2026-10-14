import type { Logger } from "@platform/shared/node";
import { toNodeHandler } from "better-auth/node";
import express, { type Request, type RequestHandler, type Router } from "express";
import type { Redis } from "../lib/redis";
import { JSON_LIMIT } from "../middleware/body-parsers";
import { RATE_LIMITS, rateLimit } from "../middleware/rate-limit";
import { type Auth, authRequestHandler } from "./auth";
import type { CaptchaVerifier } from "./captcha";
import { newPasswordGuard } from "./password-reset";
import { signInGuard } from "./sign-in";
import { signUpGuard } from "./sign-up";

// Router `/auth/*` (ARCHITECTURE §9.1): rate limit → guard registrasi → handler Better Auth. Dipasang sebelum body
// parser global; hanya rute registrasi yang mem-parse JSON sendiri (Better Auth membaca stream untuk rute lain).

const byIp = (req: Request) => `ip:${req.ip ?? "unknown"}`;

/** Kunci per alamat email di body (sudah di-parse); body tanpa email → per IP. */
const byBodyEmail = (req: Request) => {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? `email:${email.trim().toLowerCase()}` : byIp(req);
};

/**
 * Parse JSON untuk rute yang perlu membaca body sebelum Better Auth. BA lalu membaca `req.body` yang sudah di-parse
 * (stream habis) dan menyusun ulang body-nya, sehingga `content-length` asli tidak berlaku lagi.
 */
const jsonForBetterAuth = (): RequestHandler[] => [
  express.json({ limit: JSON_LIMIT }),
  (req, _res, next) => {
    delete req.headers["content-length"];
    next();
  },
];

export function createAuthRouter(deps: {
  auth: Auth;
  logger: Logger;
  redis?: Redis;
  rateLimitPrefix?: string;
  verifyCaptcha: CaptchaVerifier;
}): Router {
  const router = express.Router();
  const limiterOptions = deps.rateLimitPrefix ? { keyPrefix: deps.rateLimitPrefix } : {};
  if (deps.redis) {
    // Mutasi auth (sign-in, sign-up, reset, …) per IP. GET (get-session) tidak dibatasi: dipanggil setiap halaman.
    router.use(
      rateLimit(
        deps.redis,
        { name: "auth", windows: RATE_LIMITS.auth, key: (req) => (req.method === "GET" ? null : byIp(req)) },
        limiterOptions,
      ),
    );
  }
  router.post(
    "/sign-up/email",
    ...(deps.redis
      ? [rateLimit(deps.redis, { name: "sign-up", windows: RATE_LIMITS.signUp, key: byIp }, limiterOptions)]
      : []),
    ...jsonForBetterAuth(),
    signUpGuard(),
  );
  if (deps.redis) {
    // Login: kunci per (email, IP) & Turnstile setelah gagal berulang (ACC-004).
    router.post(
      "/sign-in/email",
      ...jsonForBetterAuth(),
      signInGuard({ redis: deps.redis, verifyCaptcha: deps.verifyCaptcha, logger: deps.logger }),
    );
    router.post(
      "/send-verification-email",
      ...jsonForBetterAuth(),
      rateLimit(
        deps.redis,
        { name: "verification-email", windows: RATE_LIMITS.verificationEmail, key: byBodyEmail },
        limiterOptions,
      ),
    );
  }
  if (deps.redis) {
    router.post(
      "/request-password-reset",
      ...jsonForBetterAuth(),
      rateLimit(
        deps.redis,
        { name: "password-reset-email", windows: RATE_LIMITS.passwordResetEmail, key: byBodyEmail },
        limiterOptions,
      ),
    );
  }
  // Kebijakan password untuk password baru (ACC-001/ACC-005), termasuk ganti password dari pengaturan.
  router.post("/reset-password", ...jsonForBetterAuth(), newPasswordGuard());
  router.post("/change-password", ...jsonForBetterAuth(), newPasswordGuard());
  router.all("/*splat", toNodeHandler(authRequestHandler(deps.auth)));
  return router;
}
