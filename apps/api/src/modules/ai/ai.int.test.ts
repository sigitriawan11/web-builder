import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authTestApp, sessionCookie, signUpBody, TEST_ORIGIN, uniqueEmail } from "../../auth/auth.test-harness";
import type { StaffRole } from "../../middleware/staff";
import { publishRunEvent } from "./ai.sse";

// T3.13.8 (AI-051): endpoint run AI + SSE. Non-staf → 404; staf → buat run (ai_runs) + stream event (replay backlog).
let testDb: TestDb;
let redis: Redis;
let target: Express;
let ipCounter = 0;

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  target = authTestApp(testDb, redis);
});
afterAll(async () => {
  redis.disconnect();
  await testDb.drop();
});

async function register(staffRole?: StaffRole) {
  const email = uniqueEmail();
  const response = await request(target)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", `198.18.12.${(ipCounter++ % 250) + 1}`)
    .send(signUpBody(email));
  if (staffRole) await testDb.db.update(schema.users).set({ staffRole }).where(eq(schema.users.email, email));
  return sessionCookie(response.headers["set-cookie"]) ?? "";
}

describe("AI runs + SSE (AI-051)", () => {
  it("non-staf → 404 (POST runs & GET events); tanpa sesi → 401", async () => {
    const plain = await register();
    expect((await request(target).post("/v1/ai/runs").set("cookie", plain).send({ prompt: "hi" })).status).toBe(404);
    const fakeRun = "01a16000-0000-7000-8000-000000000000";
    expect((await request(target).get(`/v1/ai/runs/${fakeRun}/events?close=true`).set("cookie", plain)).status).toBe(
      404,
    );
    expect((await request(target).post("/v1/ai/runs").send({ prompt: "hi" })).status).toBe(401);
  });

  it("staf: buat run → ai_runs queued; SSE replay backlog event", async () => {
    const admin = await register("library_admin");
    const created = await request(target)
      .post("/v1/ai/runs")
      .set("cookie", admin)
      .send({ kind: "admin", prompt: "buat 3 variasi hero" });
    expect(created.status).toBe(201);
    const { runId } = created.body.data as { runId: string };

    const [row] = await testDb.db.select().from(schema.aiRuns).where(eq(schema.aiRuns.id, runId));
    expect(row?.status).toBe("queued");
    expect(row?.kind).toBe("admin");

    // Worker (disimulasikan) menulis event ke stream.
    await publishRunEvent(redis, runId, "run.started", { runId });
    await publishRunEvent(redis, runId, "tool.completed", { tool: "insert_component" });

    // SSE replay backlog (close=true → tutup setelah backlog) → body berisi kedua event.
    const sse = await request(target).get(`/v1/ai/runs/${runId}/events?close=true`).set("cookie", admin);
    expect(sse.status).toBe(200);
    expect(sse.headers["content-type"]).toContain("text/event-stream");
    expect(sse.text).toContain("event: run.started");
    expect(sse.text).toContain("event: tool.completed");
    expect(sse.text).toContain("insert_component");
  });
});
