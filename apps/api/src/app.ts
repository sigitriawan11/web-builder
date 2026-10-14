import type { Db } from "@platform/db";
import type { Logger } from "@platform/shared/node";
import express, { type Express } from "express";
import { AUTH_BASE_PATH, type Auth } from "./auth/auth";
import { touchSession } from "./auth/auth.repository";
import { createAuthRouter } from "./auth/auth.routes";
import type { CaptchaVerifier } from "./auth/captcha";
import { type ReadinessCheck, readinessHandler } from "./health/readiness";
import { createInternalRouter } from "./internal/internal.routes";
import type { Redis } from "./lib/redis";
import { authSession } from "./middleware/auth-session";
import { bodyParsers } from "./middleware/body-parsers";
import { type ErrorReporter, errorHandler, notFound } from "./middleware/error-handler";
import { httpLogger } from "./middleware/http-logger";
import { requestId } from "./middleware/request-id";
import { securityHeaders } from "./middleware/security";
import { createAccountRouter } from "./modules/account/account.routes";
import { createAccountService } from "./modules/account/account.service";
import { createRealtimeTokenRouter } from "./modules/realtime-token/realtime-token.routes";
import { createRealtimeTokenService } from "./modules/realtime-token/realtime-token.service";
import { createSiteScopeRouter } from "./modules/sites/site-scope.routes";
import { createWorkspaceRouter } from "./modules/workspaces/workspaces.routes";
import type { QueueProducer } from "./queues/producer";

// createApp(): susunan middleware + router (ARCHITECTURE §5.3). Tanpa `listen` agar bisa diuji dengan supertest.
// Urutan middleware mengikuti tabel §5.3; auth, tenant, rate limit menyusul (T1.4.5, T1.5).

export interface AppDeps {
  logger: Logger;
  // Database untuk router modul (bersama `auth`: `/v1/account`).
  db?: Db;
  // Token koneksi realtime (ARCHITECTURE §5.5); bila ada (bersama auth & db), `/v1/realtime/token` dipasang.
  realtime?: { tokenSecret: string; url: string };
  // Redis untuk rate limit per router (T1.4.5); router publik memasangnya saat dibuat.
  redis?: Redis;
  // Prefix kunci rate limit (test: counter terpisah per app).
  rateLimitPrefix?: string;
  // Better Auth (T1.5.1); bila ada, handler dipasang di `/auth/*` dan authSession mengisi `req.ctx.user`.
  auth?: Auth;
  // Verifikasi Turnstile untuk login setelah gagal berulang; default menolak (fail closed).
  verifyCaptcha?: CaptchaVerifier;
  // Secret JWT internal; bila ada, router `/internal/v1` dipasang (dilindungi service token).
  internalJwtSecret?: string;
  // Producer job untuk service (enqueue lewat `withTransaction` + afterCommit).
  queues?: QueueProducer;
  // Pengecekan `/health/ready` (DB, Redis, storage) — dirakit server dari dependensi nyata.
  readinessChecks?: Readonly<Record<string, ReadinessCheck>>;
  // Untuk test & komposisi: router tambahan dipasang sebelum handler 404/error.
  mountRoutes?: (app: Express) => void;
  // Pelapor error tak terduga (Sentry, T1.16.3); default hanya log.
  reportError?: ErrorReporter;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  // Di belakang proxy (Next.js rewrite / load balancer): IP & protokol dari header X-Forwarded-*.
  app.set("trust proxy", 1);

  app.use(requestId()); // 1
  app.use(httpLogger(deps.logger)); // 2
  app.use(securityHeaders()); // 3
  // 4 — CORS dipasang per router publik (`corsFor`), bukan global.
  // Auth sebelum body parser: Better Auth membaca body request sendiri.
  if (deps.auth) {
    // Router auth butuh DB (re-auth ganti email, consent); tanpa DB jangan diam-diam melonggarkan keamanan.
    if (!deps.db) throw new Error("createApp: `auth` membutuhkan `db`");
    app.use(
      AUTH_BASE_PATH,
      createAuthRouter({
        auth: deps.auth,
        db: deps.db,
        logger: deps.logger,
        verifyCaptcha: deps.verifyCaptcha ?? (async () => false),
        ...(deps.redis ? { redis: deps.redis } : {}),
        ...(deps.rateLimitPrefix ? { rateLimitPrefix: deps.rateLimitPrefix } : {}),
      }),
    );
  }
  app.use(bodyParsers()); // 5

  // Liveness: proses hidup & event loop merespons; tidak menyentuh dependensi (readiness = T1.4.6).
  app.get("/health/live", (_req, res) => {
    res.json({ status: "ok" });
  });
  // Readiness: dependensi terjangkau → 200, salah satu gagal → 503.
  app.get("/health/ready", readinessHandler(deps.readinessChecks ?? {}, { logger: deps.logger }));

  // 6 — sesi pengguna untuk router berikutnya (health di atas tidak menyentuh sesi).
  if (deps.auth) {
    const { db, logger } = deps;
    app.use(
      authSession(deps.auth, {
        ...(db
          ? {
              onActive: (sessionId, staleBefore) => {
                touchSession(db, sessionId, staleBefore).catch((error: unknown) =>
                  logger.warn({ err: error }, "last_active_at sesi gagal diperbarui"),
                );
              },
            }
          : {}),
      }),
    );
  }

  if (deps.auth && deps.db) {
    const auth = deps.auth;
    app.use(
      "/v1/account",
      createAccountRouter({
        service: createAccountService({
          db: deps.db,
          revokeSessionTokens: async (tokens) => {
            await (await auth.$context).internalAdapter.deleteSessions(tokens);
          },
          updateUser: async (userId, fields) => {
            await (await auth.$context).internalAdapter.updateUser(userId, fields);
          },
        }),
        ...(deps.redis ? { redis: deps.redis } : {}),
        ...(deps.rateLimitPrefix ? { rateLimitPrefix: deps.rateLimitPrefix } : {}),
      }),
    );
  }

  if (deps.auth && deps.db) {
    app.use(
      "/v1/workspaces/:workspaceId",
      createWorkspaceRouter({ db: deps.db, ...(deps.redis ? { redis: deps.redis } : {}) }),
    );
    app.use("/v1/sites/:siteId", createSiteScopeRouter({ db: deps.db, ...(deps.redis ? { redis: deps.redis } : {}) }));
    if (deps.realtime) {
      app.use(
        "/v1/realtime",
        createRealtimeTokenRouter({
          service: createRealtimeTokenService({
            db: deps.db,
            secret: deps.realtime.tokenSecret,
            url: deps.realtime.url,
          }),
          ...(deps.redis ? { redis: deps.redis } : {}),
          ...(deps.rateLimitPrefix ? { rateLimitPrefix: deps.rateLimitPrefix } : {}),
        }),
      );
    }
  }

  if (deps.internalJwtSecret)
    app.use(
      "/internal/v1",
      createInternalRouter({
        internalJwtSecret: deps.internalJwtSecret,
        logger: deps.logger,
        ...(deps.db ? { db: deps.db } : {}),
      }),
    );

  deps.mountRoutes?.(app);

  app.use(notFound()); // 12
  app.use(errorHandler({ logger: deps.logger, ...(deps.reportError ? { reportError: deps.reportError } : {}) }));
  return app;
}
