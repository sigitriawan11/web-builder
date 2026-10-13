import { randomBytes } from "node:crypto";
import { ErrorBodySchema } from "@platform/shared/contracts";
import type { Express } from "express";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createRedis, type Redis } from "../lib/redis";
import { silentLogger } from "../test-utils";
import { byUserOrIp, type RateLimitPolicy, rateLimit } from "./rate-limit";

// Prefix unik per run: key Redis dari run sebelumnya (TTL 60 s) tidak memengaruhi hasil.
const runPrefix = `rl-test-${randomBytes(4).toString("hex")}`;
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const clients: Redis[] = [];
afterAll(() => {
  for (const client of clients) client.disconnect();
});

function appWith(policy: RateLimitPolicy, redis: Redis): Express {
  return createApp({
    logger: silentLogger(),
    mountRoutes: (app) => {
      app.get("/limited", rateLimit(redis, policy, { keyPrefix: runPrefix }), (_req, res) => {
        res.json({ ok: true });
      });
    },
  });
}

async function connectedRedis(): Promise<Redis> {
  const redis = createRedis(redisUrl);
  clients.push(redis);
  await new Promise<void>((resolve, reject) => {
    redis.once("ready", () => resolve());
    redis.once("error", reject);
  });
  return redis;
}

describe("rateLimit Redis (ARCHITECTURE §9.6)", () => {
  it("lolos sampai N request, request ke-N+1 → 429 RATE_LIMITED + Retry-After", async () => {
    const app = appWith(
      { name: "n-plus-one", windows: [{ points: 3, durationSeconds: 60 }], key: byUserOrIp },
      await connectedRedis(),
    );
    for (let i = 0; i < 3; i++) expect((await request(app).get("/limited")).status).toBe(200);
    const blocked = await request(app).get("/limited");
    expect(blocked.status).toBe(429);
    expect(ErrorBodySchema.parse(blocked.body).error.code).toBe("RATE_LIMITED");
    const retryAfter = Number(blocked.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("kunci berbeda (IP lain lewat X-Forwarded-For) punya kuota sendiri", async () => {
    const app = appWith(
      { name: "per-ip", windows: [{ points: 1, durationSeconds: 60 }], key: byUserOrIp },
      await connectedRedis(),
    );
    expect((await request(app).get("/limited").set("x-forwarded-for", "203.0.113.1")).status).toBe(200);
    expect((await request(app).get("/limited").set("x-forwarded-for", "203.0.113.1")).status).toBe(429);
    expect((await request(app).get("/limited").set("x-forwarded-for", "203.0.113.2")).status).toBe(200);
  });

  it("beberapa jendela: jendela yang paling ketat yang menolak", async () => {
    const app = appWith(
      {
        name: "multi",
        windows: [
          { points: 5, durationSeconds: 60 },
          { points: 2, durationSeconds: 3600 },
        ],
        key: byUserOrIp,
      },
      await connectedRedis(),
    );
    expect((await request(app).get("/limited")).status).toBe(200);
    expect((await request(app).get("/limited")).status).toBe(200);
    const blocked = await request(app).get("/limited");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(60);
  });

  it("kunci null → policy tidak berlaku", async () => {
    const app = appWith(
      { name: "skip", windows: [{ points: 1, durationSeconds: 60 }], key: () => null },
      await connectedRedis(),
    );
    for (let i = 0; i < 3; i++) expect((await request(app).get("/limited")).status).toBe(200);
  });

  it("Redis mati → limiter cadangan in-memory tetap membatasi (tidak fail-open)", async () => {
    const down = createRedis("redis://127.0.0.1:1");
    down.on("error", () => {});
    clients.push(down);
    const app = appWith({ name: "insurance", windows: [{ points: 2, durationSeconds: 60 }], key: byUserOrIp }, down);
    expect((await request(app).get("/limited")).status).toBe(200);
    expect((await request(app).get("/limited")).status).toBe(200);
    expect((await request(app).get("/limited")).status).toBe(429);
  });
});
