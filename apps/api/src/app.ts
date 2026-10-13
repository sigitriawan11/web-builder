import type { Logger } from "@platform/shared/node";
import express, { type Express } from "express";
import { type ReadinessCheck, readinessHandler } from "./health/readiness";
import type { Redis } from "./lib/redis";
import { bodyParsers } from "./middleware/body-parsers";
import { type ErrorReporter, errorHandler, notFound } from "./middleware/error-handler";
import { httpLogger } from "./middleware/http-logger";
import { requestId } from "./middleware/request-id";
import { securityHeaders } from "./middleware/security";

// createApp(): susunan middleware + router (ARCHITECTURE §5.3). Tanpa `listen` agar bisa diuji dengan supertest.
// Urutan middleware mengikuti tabel §5.3; auth, tenant, rate limit menyusul (T1.4.5, T1.5).

export interface AppDeps {
  logger: Logger;
  // Redis untuk rate limit per router (T1.4.5); router publik memasangnya saat dibuat.
  redis?: Redis;
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
  app.use(bodyParsers()); // 5

  // Liveness: proses hidup & event loop merespons; tidak menyentuh dependensi (readiness = T1.4.6).
  app.get("/health/live", (_req, res) => {
    res.json({ status: "ok" });
  });
  // Readiness: dependensi terjangkau → 200, salah satu gagal → 503.
  app.get("/health/ready", readinessHandler(deps.readinessChecks ?? {}, { logger: deps.logger }));

  deps.mountRoutes?.(app);

  app.use(notFound()); // 12
  app.use(errorHandler({ logger: deps.logger, ...(deps.reportError ? { reportError: deps.reportError } : {}) }));
  return app;
}
