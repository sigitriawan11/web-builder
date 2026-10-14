import { and, eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authTestApp,
  STRONG_PASSWORD,
  sessionCookie,
  signUpBody,
  TEST_ORIGIN,
  uniqueEmail,
} from "../../auth/auth.test-harness";

// T1.5.7 (ACC-007): daftar & cabut sesi dari Postgres; pencabutan berlaku seketika (DB + cache Redis).
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

let ipCounter = 0;
const uniqueIp = () => `203.0.113.${(ipCounter++ % 250) + 1}`;

/** User dengan sesi registrasi (A) + `extra` sesi login dari perangkat lain. */
async function userWithSessions(target: Express, extra: number) {
  const email = uniqueEmail();
  const signUp = await request(target)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", uniqueIp())
    .set("user-agent", "Laptop/1.0")
    .send(signUpBody(email));
  const current = sessionCookie(signUp.headers["set-cookie"]) ?? "";
  const others: string[] = [];
  for (let index = 0; index < extra; index++) {
    const signIn = await request(target)
      .post("/auth/sign-in/email")
      .set("origin", TEST_ORIGIN)
      .set("x-forwarded-for", uniqueIp())
      .set("user-agent", `Ponsel/${index}`)
      .set("cf-ipcountry", "ID")
      .send({ email, password: STRONG_PASSWORD });
    others.push(sessionCookie(signIn.headers["set-cookie"]) ?? "");
  }
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  return { email, current, others, userId: user?.id ?? "" };
}

const sessions = (target: Express, cookie: string) => request(target).get("/v1/account/sessions").set("cookie", cookie);
const signedIn = async (target: Express, cookie: string) => (await sessions(target, cookie)).status === 200;

describe("sesi & perangkat (ACC-007)", () => {
  it("daftar sesi: perangkat ini ditandai, user agent & lokasi tercatat, token tidak pernah dikirim", async () => {
    const target = authTestApp(testDb, redis);
    const { current } = await userWithSessions(target, 1);
    const response = await sessions(target, current);
    expect(response.status).toBe(200);
    const list = response.body.data as Array<Record<string, unknown>>;
    expect(list).toHaveLength(2);
    expect(list.find((session) => session.current)).toMatchObject({ userAgent: "Laptop/1.0", geo: null });
    expect(list.find((session) => !session.current)).toMatchObject({ userAgent: "Ponsel/0", geo: { country: "ID" } });
    expect(JSON.stringify(response.body)).not.toMatch(/token/i);
  });

  it("cabut sesi lain → perangkat itu langsung 401 (cache Redis ikut terhapus); audit tercatat", async () => {
    const target = authTestApp(testDb, redis);
    const { current, others, userId } = await userWithSessions(target, 1);
    const other = others[0] ?? "";
    expect(await signedIn(target, other)).toBe(true); // sesi lain sempat dipakai → ada di cache Redis
    const list = (await sessions(target, current)).body.data as Array<{ id: string; current: boolean }>;
    const otherId = list.find((session) => !session.current)?.id ?? "";

    const revoke = await request(target)
      .delete(`/v1/account/sessions/${otherId}`)
      .set("origin", TEST_ORIGIN)
      .set("cookie", current);
    expect(revoke.status).toBe(204);
    expect(await signedIn(target, other)).toBe(false);
    expect(await signedIn(target, current)).toBe(true);
    const audit = await testDb.db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "auth.session_revoke"), eq(schema.auditLogs.actorId, userId)));
    expect(audit[0]?.metadata).toEqual({ sessionId: otherId });
  });

  it("sesi saat ini tidak bisa dicabut dari daftar (409); sesi milik user lain = 404", async () => {
    const target = authTestApp(testDb, redis);
    const alice = await userWithSessions(target, 0);
    const bob = await userWithSessions(target, 0);
    const aliceSessionId = ((await sessions(target, alice.current)).body.data as Array<{ id: string }>)[0]?.id;

    const own = await request(target)
      .delete(`/v1/account/sessions/${aliceSessionId}`)
      .set("origin", TEST_ORIGIN)
      .set("cookie", alice.current);
    expect(own.status).toBe(409);
    expect(own.body.error.details).toEqual({ reason: "current_session" });

    const foreign = await request(target)
      .delete(`/v1/account/sessions/${aliceSessionId}`)
      .set("origin", TEST_ORIGIN)
      .set("cookie", bob.current);
    expect(foreign.status).toBe(404);
    expect(await signedIn(target, alice.current)).toBe(true);
  });

  it("keluar dari semua perangkat lain — walau cache sesi Redis sudah kedaluwarsa", async () => {
    const target = authTestApp(testDb, redis);
    const { current, others, userId } = await userWithSessions(target, 2);
    const keys = await redis.keys(`auth:*${userId}*`);
    if (keys.length > 0) await redis.del(...keys);

    const response = await request(target)
      .post("/v1/account/sessions/revoke-others")
      .set("origin", TEST_ORIGIN)
      .set("cookie", current);
    expect(response.body.data).toEqual({ revoked: 2 });
    for (const other of others) expect(await signedIn(target, other)).toBe(false);
    expect(await signedIn(target, current)).toBe(true);
  });

  it("last_active_at diperbarui saat sesi dipakai (maks sekali per 5 menit)", async () => {
    const target = authTestApp(testDb, redis);
    const { current, userId } = await userWithSessions(target, 0);
    const old = new Date(Date.now() - 60 * 60_000);
    await testDb.db.update(schema.sessions).set({ lastActiveAt: old }).where(eq(schema.sessions.userId, userId));
    // App baru = cache throttle kosong (seperti proses lain / setelah 5 menit).
    await sessions(authTestApp(testDb, redis), current);
    await expect
      .poll(async () => {
        const [row] = await testDb.db.select().from(schema.sessions).where(eq(schema.sessions.userId, userId));
        return row?.lastActiveAt?.getTime() ?? 0;
      })
      .toBeGreaterThan(old.getTime() + 30 * 60_000);
  });

  it("endpoint sesi bawaan Better Auth (berbasis cache) dimatikan", async () => {
    const target = authTestApp(testDb, redis);
    const { current } = await userWithSessions(target, 0);
    expect((await request(target).get("/auth/list-sessions").set("cookie", current)).status).toBe(404);
    const revokeOthers = await request(target)
      .post("/auth/revoke-other-sessions")
      .set("origin", TEST_ORIGIN)
      .set("cookie", current)
      .send({});
    expect(revokeOthers.status).toBe(404);
  });

  it("tanpa sesi → 401", async () => {
    expect((await request(authTestApp(testDb, redis)).get("/v1/account/sessions")).status).toBe(401);
  });
});
