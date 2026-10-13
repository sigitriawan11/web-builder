import { and, eq, schema, sql } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireAuth } from "../middleware/auth-session";
import { authTestApp, STRONG_PASSWORD, sessionCookie, signUpBody, TEST_ORIGIN, uniqueEmail } from "./auth.test-harness";
import { CAPTCHA_HEADER, SIGN_IN_FAILURE_WINDOW_SECONDS } from "./sign-in";

// T1.5.4 (ACC-004): login/logout, ingat saya, kunci per (email, IP) + Turnstile, audit, authSession/requireAuth.
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

// Turnstile palsu: token "lolos" valid, lainnya tidak.
const verifyCaptcha = async (token: string) => token === "lolos";
let ipCounter = 0;
const uniqueIp = () => `203.0.113.${(ipCounter++ % 250) + 1}`;

function app(): Express {
  return authTestApp(testDb, redis, undefined, {
    verifyCaptcha,
    mountRoutes: (target) => {
      target.get("/v1/me", requireAuth(), (req, res) => {
        res.json({ data: req.ctx.user });
      });
    },
  });
}

async function registeredUser(target: Express, ip: string) {
  const email = uniqueEmail();
  await request(target)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", ip)
    .send(signUpBody(email));
  return email;
}

function signIn(target: Express, ip: string, body: Record<string, unknown>, captcha?: string) {
  const call = request(target).post("/auth/sign-in/email").set("origin", TEST_ORIGIN).set("x-forwarded-for", ip);
  return (captcha ? call.set(CAPTCHA_HEADER, captcha) : call).send(body);
}

describe("authSession & requireAuth (ARCHITECTURE §5.3)", () => {
  it("endpoint terproteksi tanpa sesi → 401 UNAUTHENTICATED (envelope API)", async () => {
    const response = await request(app()).get("/v1/me");
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", requestId: expect.any(String) });
  });

  it("dengan sesi → req.ctx.user terisi; setelah logout → 401 lagi", async () => {
    const target = app();
    const ip = uniqueIp();
    const email = await registeredUser(target, ip);
    const login = await signIn(target, ip, { email, password: STRONG_PASSWORD });
    const cookie = sessionCookie(login.headers["set-cookie"]) ?? "";
    const me = await request(target).get("/v1/me").set("cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ email, name: "Budi Santoso", emailVerified: false });
    expect(Object.keys(me.body.data).sort()).toEqual(["email", "emailVerified", "id", "name"]);

    const logout = await request(target).post("/auth/sign-out").set("origin", TEST_ORIGIN).set("cookie", cookie);
    expect(logout.status).toBe(200);
    expect((await request(target).get("/v1/me").set("cookie", cookie)).status).toBe(401);
  });
});

describe("login & ingat saya (ACC-004)", () => {
  it("default ingat saya: cookie persisten ~30 hari", async () => {
    const target = app();
    const ip = uniqueIp();
    const email = await registeredUser(target, ip);
    const cookie = ([] as string[])
      .concat((await signIn(target, ip, { email, password: STRONG_PASSWORD })).headers["set-cookie"] ?? [])
      .find((value) => value.startsWith("platform.session_token="));
    const maxAge = Number(/Max-Age=(\d+)/i.exec(cookie ?? "")?.[1]);
    expect(maxAge).toBeGreaterThan(29 * 86_400);
  });

  it("tanpa ingat saya: cookie sesi browser + sesi server 1 hari", async () => {
    const target = app();
    const ip = uniqueIp();
    const email = await registeredUser(target, ip);
    const response = await signIn(target, ip, { email, password: STRONG_PASSWORD, rememberMe: false });
    const cookie = ([] as string[])
      .concat(response.headers["set-cookie"] ?? [])
      .find((value) => value.startsWith("platform.session_token="));
    expect(cookie).not.toMatch(/Max-Age|Expires/i);
    const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
    const [latest] = await testDb.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, user?.id ?? ""))
      .orderBy(sql`${schema.sessions.createdAt} desc`)
      .limit(1);
    const hours = ((latest?.expiresAt.getTime() ?? 0) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThan(25);
  });
});

describe("percobaan gagal per (email, IP) (ACC-004)", () => {
  it("3× gagal → Turnstile wajib; 5× gagal → terkunci 15 menit walau password benar; IP lain tidak terkunci", async () => {
    const target = app();
    const ip = uniqueIp();
    const email = await registeredUser(target, ip);
    const wrong = { email, password: "salah-sekali-123" };
    for (let attempt = 0; attempt < 3; attempt++) expect((await signIn(target, ip, wrong)).status).toBe(401);

    const missing = await signIn(target, ip, wrong);
    expect(missing.status).toBe(403);
    expect(missing.body.error).toMatchObject({ code: "CAPTCHA_REQUIRED", details: { reason: "missing" } });
    const invalid = await signIn(target, ip, wrong, "palsu");
    expect(invalid.body.error).toMatchObject({ code: "CAPTCHA_REQUIRED", details: { reason: "invalid" } });

    expect((await signIn(target, ip, wrong, "lolos")).status).toBe(401);
    expect((await signIn(target, ip, wrong, "lolos")).status).toBe(401);

    const locked = await signIn(target, ip, { email, password: STRONG_PASSWORD }, "lolos");
    expect(locked.status).toBe(429);
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(SIGN_IN_FAILURE_WINDOW_SECONDS - 10);

    expect((await signIn(target, uniqueIp(), { email, password: STRONG_PASSWORD })).status).toBe(200);
  });

  it("login berhasil mereset hitungan gagal", async () => {
    const target = app();
    const ip = uniqueIp();
    const email = await registeredUser(target, ip);
    const wrong = { email, password: "salah-sekali-123" };
    for (let attempt = 0; attempt < 2; attempt++) await signIn(target, ip, wrong);
    expect((await signIn(target, ip, { email, password: STRONG_PASSWORD })).status).toBe(200);
    for (let attempt = 0; attempt < 2; attempt++) expect((await signIn(target, ip, wrong)).status).toBe(401);
    // Hitungan mulai dari 0 lagi → percobaan ke-3 setelah reset belum butuh captcha.
    expect((await signIn(target, ip, wrong)).status).toBe(401);
  });

  it("email tak terdaftar: pesan generik yang sama dengan password salah", async () => {
    const target = app();
    const ip = uniqueIp();
    const email = await registeredUser(target, ip);
    const unknown = await signIn(target, uniqueIp(), { email: uniqueEmail(), password: STRONG_PASSWORD });
    const wrong = await signIn(target, uniqueIp(), { email, password: "salah-sekali-123" });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });
});

describe("audit login (ACC-004)", () => {
  it("auth.login & auth.login_failed tercatat dengan IP & user agent, tanpa password", async () => {
    const target = app();
    const ip = uniqueIp();
    const email = await registeredUser(target, ip);
    await request(target)
      .post("/auth/sign-in/email")
      .set("origin", TEST_ORIGIN)
      .set("x-forwarded-for", ip)
      .set("user-agent", "AuditBrowser/2.0")
      .send({ email, password: "salah-sekali-123" });
    await signIn(target, ip, { email, password: STRONG_PASSWORD });
    const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));

    const failed = await testDb.db
      .select()
      .from(schema.auditLogs)
      .where(
        and(eq(schema.auditLogs.action, "auth.login_failed"), sql`${schema.auditLogs.metadata}->>'email' = ${email}`),
      );
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ ip, userAgent: "AuditBrowser/2.0", actorId: null });

    const success = await testDb.db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "auth.login"), eq(schema.auditLogs.actorId, user?.id ?? "")));
    expect(success).toHaveLength(1);
    expect(success[0]?.ip).toBe(ip);
    // id audit = bigint (identity) → diserialisasi sebagai string.
    const serialized = JSON.stringify([...failed, ...success], (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    expect(serialized).not.toMatch(/salah-sekali|Kue-Lapis/);
  });
});
