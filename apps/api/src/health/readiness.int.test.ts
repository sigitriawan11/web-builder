import { describe, expect, it } from "vitest";
import { loadApiEnv } from "../config/env";
import { startServer } from "../server";
import { freePort } from "../test-utils";

// T1.4.6: server sungguhan dengan DB & storage dari .env; Redis hidup vs tidak terjangkau.
async function readyResponse(overrides: Record<string, string>) {
  const port = await freePort();
  const env = loadApiEnv({ ...process.env, APP_ENV: "staging", API_PORT: String(port), ...overrides });
  const running = await startServer(env);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
    return { status: response.status, body: (await response.json()) as unknown };
  } finally {
    await running.close("test");
  }
}

describe("GET /health/ready (ARCHITECTURE §13)", () => {
  it("DB, Redis, storage hidup → 200 ready", async () => {
    expect(await readyResponse({})).toEqual({
      status: 200,
      body: { status: "ready", checks: { db: "ok", redis: "ok", storage: "ok" } },
    });
  });

  it("Redis mati → 503, hanya redis yang fail", async () => {
    expect(await readyResponse({ REDIS_URL: "redis://127.0.0.1:1" })).toEqual({
      status: 503,
      body: { status: "not_ready", checks: { db: "ok", redis: "fail", storage: "ok" } },
    });
  });

  it("DB tidak terjangkau → 503 dengan db fail", async () => {
    const result = await readyResponse({ DATABASE_URL: "postgres://platform:platform@127.0.0.1:1/x" });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ checks: { db: "fail", redis: "ok", storage: "ok" } });
  });
});
