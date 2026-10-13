import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { silentLogger } from "../test-utils";
import { readinessHandler } from "./readiness";

function appWith(checks: Record<string, () => Promise<void>>, timeoutMs?: number) {
  const app = express();
  app.get("/ready", readinessHandler(checks, { logger: silentLogger(), ...(timeoutMs ? { timeoutMs } : {}) }));
  return app;
}

describe("readinessHandler (ARCHITECTURE §13)", () => {
  it("semua pengecekan lulus → 200 ready", async () => {
    const response = await request(appWith({ db: async () => {}, redis: async () => {} })).get("/ready");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready", checks: { db: "ok", redis: "ok" } });
  });

  it("satu gagal → 503 not_ready, hanya ok/fail (alasan tidak dikirim ke klien)", async () => {
    const response = await request(
      appWith({
        db: async () => {},
        redis: async () => {
          throw new Error("ECONNREFUSED 10.0.0.5:6379 password=rahasia");
        },
      }),
    ).get("/ready");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "not_ready", checks: { db: "ok", redis: "fail" } });
    expect(JSON.stringify(response.body)).not.toMatch(/ECONNREFUSED|rahasia/);
  });

  it("pengecekan yang menggantung dianggap gagal setelah timeout", async () => {
    const started = Date.now();
    const response = await request(appWith({ storage: () => new Promise(() => {}) }, 50)).get("/ready");
    expect(response.status).toBe(503);
    expect(response.body.checks).toEqual({ storage: "fail" });
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
