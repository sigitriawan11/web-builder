import { toNodeHandler } from "better-auth/node";
import express, { type Request, type Router } from "express";
import type { Redis } from "../lib/redis";
import { JSON_LIMIT } from "../middleware/body-parsers";
import { RATE_LIMITS, rateLimit } from "../middleware/rate-limit";
import { type Auth, authRequestHandler } from "./auth";
import { signUpGuard } from "./sign-up";

// Router `/auth/*` (ARCHITECTURE §9.1): rate limit → guard registrasi → handler Better Auth. Dipasang sebelum body
// parser global; hanya rute registrasi yang mem-parse JSON sendiri (Better Auth membaca stream untuk rute lain).

const byIp = (req: Request) => `ip:${req.ip ?? "unknown"}`;

export function createAuthRouter(deps: { auth: Auth; redis?: Redis; rateLimitPrefix?: string }): Router {
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
    express.json({ limit: JSON_LIMIT }),
    signUpGuard(),
  );
  router.all("/*splat", toNodeHandler(authRequestHandler(deps.auth)));
  return router;
}
