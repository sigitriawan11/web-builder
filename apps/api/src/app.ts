import type { Logger } from "@platform/shared/node";
import express, { type Express } from "express";

// createApp(): susunan middleware + router (ARCHITECTURE §5.3). Tanpa `listen` agar bisa diuji dengan supertest.
// Middleware chain lengkap ditambahkan bertahap (T1.4.2–T1.4.9).

export interface AppDeps {
  logger: Logger;
}

export function createApp(_deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  // Di belakang proxy (Next.js rewrite / load balancer): IP & protokol dari header X-Forwarded-*.
  app.set("trust proxy", 1);

  // Liveness: proses hidup & event loop merespons; tidak menyentuh dependensi (readiness = T1.4.6).
  app.get("/health/live", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
