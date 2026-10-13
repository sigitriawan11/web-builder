import type { Logger } from "@platform/shared/node";
import express, { type Express } from "express";
import { bodyParsers } from "./middleware/body-parsers";
import { httpLogger } from "./middleware/http-logger";
import { requestId } from "./middleware/request-id";
import { securityHeaders } from "./middleware/security";

// createApp(): susunan middleware + router (ARCHITECTURE §5.3). Tanpa `listen` agar bisa diuji dengan supertest.
// Urutan middleware mengikuti tabel §5.3; sisanya (auth, tenant, rate limit, validate, error) T1.4.3–T1.5.

export interface AppDeps {
  logger: Logger;
  // Untuk test & komposisi: router tambahan dipasang sebelum handler 404/error.
  mountRoutes?: (app: Express) => void;
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

  deps.mountRoutes?.(app);
  return app;
}
