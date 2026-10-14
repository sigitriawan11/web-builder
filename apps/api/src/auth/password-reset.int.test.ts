import { and, eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RESET_PASSWORD_EXPIRES_IN } from "./auth";
import {
  authTestApp,
  type RecordedJob,
  recordingQueues,
  STRONG_PASSWORD,
  sessionCookie,
  signUpBody,
  TEST_ORIGIN,
  uniqueEmail,
} from "./auth.test-harness";

// T1.5.5 (ACC-005): lupa & reset password lewat queue `email`; token 1 jam sekali pakai; sesi lain dicabut.
const NEW_PASSWORD = "Rendang-Baru-2026!";
let testDb: TestDb;
let redis: Redis;
beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
});
afterAll(async () => {
  redis.disconnect();
  await testDb.drop();
});
afterEach(() => {
  vi.useRealTimers();
});

let ipCounter = 0;
const uniqueIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;
const apiPath = (publicUrl: string) => {
  const url = new URL(publicUrl);
  return url.pathname.replace(/^\/api/, "") + url.search;
};
const jobsOf = (jobs: RecordedJob[], template: string) =>
  jobs.map((job) => job.payload as Record<string, string>).filter((payload) => payload.template === template);

async function setup() {
  const queues = recordingQueues();
  const app = authTestApp(testDb, redis, queues);
  const ip = uniqueIp();
  const email = uniqueEmail();
  const signUp = await request(app)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", ip)
    .send(signUpBody(email));
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user) throw new Error("user tidak terbuat");
  return { app, queues, ip, email, user, signUpCookie: sessionCookie(signUp.headers["set-cookie"]) ?? "" };
}

const post = (app: Express, ip: string, path: string, body: Record<string, unknown>, cookie?: string) => {
  const call = request(app).post(path).set("origin", TEST_ORIGIN).set("x-forwarded-for", ip);
  return (cookie ? call.set("cookie", cookie) : call).send(body);
};

async function requestReset(context: Awaited<ReturnType<typeof setup>>) {
  const response = await post(context.app, context.ip, "/auth/request-password-reset", { email: context.email });
  await expect.poll(() => jobsOf(context.queues.jobs, "auth.password_reset")).toHaveLength(1);
  const resetUrl = jobsOf(context.queues.jobs, "auth.password_reset")[0]?.resetUrl ?? "";
  const token = decodeURIComponent(new URL(resetUrl).pathname.split("/").pop() ?? "");
  return { response, resetUrl, token };
}

const signedIn = async (app: Express, cookie: string) =>
  Boolean((await request(app).get("/auth/get-session").set("cookie", cookie)).body?.user);

describe("lupa & reset password (ACC-005)", () => {
  it("email terdaftar vs tidak: respons identik; hanya yang terdaftar mendapat email reset", async () => {
    const context = await setup();
    const { response, resetUrl } = await requestReset(context);
    const unknown = await post(context.app, uniqueIp(), "/auth/request-password-reset", { email: uniqueEmail() });
    expect(unknown.status).toBe(response.status);
    expect(unknown.body).toEqual(response.body);
    expect(jobsOf(context.queues.jobs, "auth.password_reset")).toHaveLength(1);

    const url = new URL(resetUrl);
    expect(url.origin + url.pathname).toMatch(new RegExp(`^${TEST_ORIGIN}/api/auth/reset-password/[^/]+$`));
    expect(url.searchParams.get("callbackURL")).toBe("/reset-password");
  });

  it("klik link → diarahkan ke form web dengan token", async () => {
    const context = await setup();
    const { resetUrl, token } = await requestReset(context);
    const response = await request(context.app).get(apiPath(resetUrl));
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`${TEST_ORIGIN}/reset-password?token=${token}`);
  });

  it("reset: password lama tidak berlaku, baru berlaku; email 'password diubah'; token sekali pakai; audit", async () => {
    const context = await setup();
    const { token } = await requestReset(context);
    expect(
      (await post(context.app, context.ip, "/auth/reset-password", { token, newPassword: NEW_PASSWORD })).status,
    ).toBe(200);
    await expect.poll(() => jobsOf(context.queues.jobs, "auth.password_changed")).toHaveLength(1);

    const login = (password: string) =>
      post(context.app, uniqueIp(), "/auth/sign-in/email", { email: context.email, password });
    expect((await login(STRONG_PASSWORD)).status).toBe(401);
    expect((await login(NEW_PASSWORD)).status).toBe(200);

    const reuse = await post(context.app, context.ip, "/auth/reset-password", {
      token,
      newPassword: "Lain-Lagi-2026!",
    });
    expect(reuse.status).toBe(400);

    const audit = await testDb.db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "auth.password_reset"), eq(schema.auditLogs.actorId, context.user.id)));
    expect(audit).toHaveLength(1);
  });

  it("password baru melanggar kebijakan → 422 WEAK_PASSWORD; token tetap bisa dipakai", async () => {
    const context = await setup();
    const { token } = await requestReset(context);
    const weak = await post(context.app, context.ip, "/auth/reset-password", { token, newPassword: "password123" });
    expect(weak.status).toBe(422);
    expect(weak.body.error).toMatchObject({ code: "WEAK_PASSWORD", details: { reason: "too_common" } });
    expect(
      (await post(context.app, context.ip, "/auth/reset-password", { token, newPassword: NEW_PASSWORD })).status,
    ).toBe(200);
  });

  it("sesi lain dicabut, sesi request ini dipertahankan — walau cache sesi Redis sudah kedaluwarsa", async () => {
    const context = await setup();
    const other = sessionCookie(
      (await post(context.app, uniqueIp(), "/auth/sign-in/email", { email: context.email, password: STRONG_PASSWORD }))
        .headers["set-cookie"],
    );
    // Simulasi cache 5 menit habis: daftar sesi & entri sesi di Redis hilang, Postgres tetap punya.
    const keys = await redis.keys(`auth:*${context.user.id}*`);
    if (keys.length > 0) await redis.del(...keys);

    const { token } = await requestReset(context);
    const reset = await post(
      context.app,
      context.ip,
      "/auth/reset-password",
      { token, newPassword: NEW_PASSWORD },
      context.signUpCookie,
    );
    expect(reset.status).toBe(200);
    expect(await signedIn(context.app, context.signUpCookie)).toBe(true);
    expect(await signedIn(context.app, other ?? "")).toBe(false);
    const remaining = await testDb.db.select().from(schema.sessions).where(eq(schema.sessions.userId, context.user.id));
    expect(remaining).toHaveLength(1);
  });

  it("reset tanpa sesi (dari email) → semua sesi dicabut", async () => {
    const context = await setup();
    const { token } = await requestReset(context);
    await post(context.app, context.ip, "/auth/reset-password", { token, newPassword: NEW_PASSWORD });
    expect(await signedIn(context.app, context.signUpCookie)).toBe(false);
  });

  it("token kedaluwarsa (> 1 jam): link → form dengan error; reset ditolak", async () => {
    const context = await setup();
    const { resetUrl, token } = await requestReset(context);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (RESET_PASSWORD_EXPIRES_IN + 60) * 1000);
    const link = await request(context.app).get(apiPath(resetUrl));
    expect(link.headers.location).toBe(`${TEST_ORIGIN}/reset-password?error=INVALID_TOKEN`);
    const reset = await post(context.app, context.ip, "/auth/reset-password", { token, newPassword: NEW_PASSWORD });
    expect(reset.status).toBe(400);
  });

  it("permintaan link reset per email: cooldown 60 detik → 429", async () => {
    const context = await setup();
    await requestReset(context);
    const again = await post(context.app, uniqueIp(), "/auth/request-password-reset", { email: context.email });
    expect(again.status).toBe(429);
  });
});
