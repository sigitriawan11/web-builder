import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { LEGAL_VERSIONS, UUIDV7_PATTERN } from "@platform/shared";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authTestApp,
  recordingQueues,
  STRONG_PASSWORD,
  sessionCookie,
  signUpBody,
  TEST_ORIGIN,
  uniqueEmail,
} from "./auth.test-harness";

// T1.5.1 + T1.5.2: Better Auth & registrasi dengan Postgres dan Redis asli.
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
let testDb: TestDb;
let redis: Redis;
let deadRedis: Redis;

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(redisUrl);
  deadRedis = new Redis("redis://127.0.0.1:1", { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
  deadRedis.on("error", () => {});
});
afterAll(async () => {
  redis.disconnect();
  deadRedis.disconnect();
  await testDb.drop();
});

const app = (client: Redis = redis, queues = recordingQueues()) => authTestApp(testDb, client, queues);

function signUp(target: ReturnType<typeof app>, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return request(target).post("/auth/sign-up/email").set("origin", TEST_ORIGIN).set(headers).send(body);
}

async function userByEmail(email: string) {
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  return user;
}

describe("Better Auth (ARCHITECTURE §9.1, ACC-004)", () => {
  it("sign-up: user UUIDv7 + akun credential ber-hash + sesi di Postgres & cache Redis", async () => {
    const email = uniqueEmail();
    const response = await signUp(app(), signUpBody(email));
    expect(response.status).toBe(200);
    const user = await userByEmail(email);
    expect(user?.id).toMatch(UUIDV7_PATTERN);
    expect(user).toMatchObject({ status: "active", emailVerified: false });

    const [account] = await testDb.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, user?.id ?? ""));
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(STRONG_PASSWORD);

    const sessions = await testDb.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, user?.id ?? ""));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toMatch(UUIDV7_PATTERN);
    expect(await redis.get(`auth:${sessions[0]?.token}`)).toContain(email);
    expect(await redis.ttl(`auth:${sessions[0]?.token}`)).toBeLessThanOrEqual(300);
  });

  it("cookie sesi: HttpOnly, SameSite=Lax, host-only; tanpa Secure di lokal", async () => {
    const response = await signUp(app(), signUpBody(uniqueEmail()));
    const cookie = ([] as string[])
      .concat(response.headers["set-cookie"] ?? [])
      .find((value) => value.startsWith("platform.session_token="));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).not.toMatch(/;\s*Secure/i);
  });

  it("sign-in → sesi; get-session membaca user; password salah → 401", async () => {
    const target = app();
    const email = uniqueEmail();
    await signUp(target, signUpBody(email));
    const signIn = await request(target)
      .post("/auth/sign-in/email")
      .set("origin", TEST_ORIGIN)
      .send({ email, password: STRONG_PASSWORD });
    expect(signIn.status).toBe(200);
    const cookie = sessionCookie(signIn.headers["set-cookie"]) ?? "";
    expect((await request(target).get("/auth/get-session").set("cookie", cookie)).body.user.email).toBe(email);

    const wrong = await request(target)
      .post("/auth/sign-in/email")
      .set("origin", TEST_ORIGIN)
      .send({ email, password: "salah-sekali-123" });
    expect(wrong.status).toBe(401);
  });

  it("sign-out menghapus sesi di Postgres DAN cache Redis", async () => {
    const target = app();
    const email = uniqueEmail();
    const cookie = sessionCookie((await signUp(target, signUpBody(email))).headers["set-cookie"]) ?? "";
    const user = await userByEmail(email);
    const [session] = await testDb.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, user?.id ?? ""));

    expect((await request(target).post("/auth/sign-out").set("origin", TEST_ORIGIN).set("cookie", cookie)).status).toBe(
      200,
    );
    expect(
      await testDb.db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, user?.id ?? "")),
    ).toHaveLength(0);
    expect(await redis.get(`auth:${session?.token}`)).toBeNull();
    expect((await request(target).get("/auth/get-session").set("cookie", cookie)).body).toBeNull();
  });

  it("Redis mati → sign-up, sign-in, dan get-session tetap jalan lewat Postgres", async () => {
    const target = app(deadRedis);
    const email = uniqueEmail();
    expect((await signUp(target, signUpBody(email))).status).toBe(200);
    const signIn = await request(target)
      .post("/auth/sign-in/email")
      .set("origin", TEST_ORIGIN)
      .send({ email, password: STRONG_PASSWORD });
    const cookie = sessionCookie(signIn.headers["set-cookie"]) ?? "";
    expect((await request(target).get("/auth/get-session").set("cookie", cookie)).body.user.email).toBe(email);
  });

  it("CSRF: request ber-cookie dari origin tidak dipercaya ditolak, sesi tetap hidup (§9.1)", async () => {
    const target = app();
    const cookie = sessionCookie((await signUp(target, signUpBody(uniqueEmail()))).headers["set-cookie"]) ?? "";
    const forged = await request(target)
      .post("/auth/sign-out")
      .set("origin", "https://jahat.example")
      .set("cookie", cookie);
    expect(forged.status).toBe(403);
    expect((await request(target).get("/auth/get-session").set("cookie", cookie)).body?.user).toBeDefined();
  });

  it("path di luar /auth tidak diteruskan ke Better Auth", async () => {
    expect((await request(app()).get("/api/auth/get-session")).status).toBe(404);
  });
});

describe("registrasi email + password (ACC-001)", () => {
  it("consent S&K, privasi, marketing tercatat dengan versi, IP, user agent", async () => {
    const email = uniqueEmail();
    await signUp(app(), signUpBody(email, { marketingOptIn: true }), { "user-agent": "TestBrowser/1.0" });
    const user = await userByEmail(email);
    const rows = await testDb.db
      .select()
      .from(schema.consents)
      .where(eq(schema.consents.userId, user?.id ?? ""));
    expect(
      rows
        .map(({ type, version, granted }) => ({ type, version, granted }))
        .sort((a, b) => a.type.localeCompare(b.type)),
    ).toEqual([
      { type: "marketing", version: LEGAL_VERSIONS.marketing, granted: true },
      { type: "privacy", version: LEGAL_VERSIONS.privacy, granted: true },
      { type: "terms", version: LEGAL_VERSIONS.terms, granted: true },
    ]);
    expect(rows.every((row) => row.ip !== null && row.userAgent === "TestBrowser/1.0")).toBe(true);
  });

  it("marketing default off: tetap dicatat sebagai granted=false", async () => {
    const email = uniqueEmail();
    await signUp(app(), signUpBody(email));
    const user = await userByEmail(email);
    const rows = await testDb.db
      .select()
      .from(schema.consents)
      .where(eq(schema.consents.userId, user?.id ?? ""));
    expect(rows.find((row) => row.type === "marketing")?.granted).toBe(false);
  });

  it("email dinormalisasi (trim + huruf kecil); bahasa dari Accept-Language, zona waktu dari browser", async () => {
    const local = uniqueEmail();
    const response = await signUp(app(), signUpBody(`  ${local.toUpperCase()} `, { timezone: "Asia/Makassar" }), {
      "accept-language": "id-ID,id;q=0.9,en;q=0.8",
    });
    expect(response.status).toBe(200);
    expect(await userByEmail(local)).toMatchObject({ locale: "id", timezone: "Asia/Makassar" });
  });

  it.each([
    ["en-US,en;q=0.9", "en"],
    ["fr-FR", "en"],
    ["fr-FR, id;q=0.5", "id"],
  ])("Accept-Language %s → locale %s; tanpa timezone → default Asia/Jakarta", async (header, locale) => {
    const email = uniqueEmail();
    await signUp(app(), signUpBody(email), { "accept-language": header });
    expect(await userByEmail(email)).toMatchObject({ locale, timezone: "Asia/Jakarta" });
  });

  it("email terdaftar: respons identik tanpa sesi, email 'akun sudah ada' dikirim, data tidak berubah", async () => {
    const queues = recordingQueues();
    const target = app(redis, queues);
    const email = uniqueEmail();
    const first = await signUp(target, signUpBody(email));
    const existing = await userByEmail(email);
    const second = await signUp(app(redis, queues), signUpBody(email.toUpperCase(), { password: "Lain-Sekali-99!" }));

    expect(second.status).toBe(first.status);
    expect(Object.keys(second.body).sort()).toEqual(Object.keys(first.body).sort());
    // Nilai juga harus sama (kecuali id & waktu): field platform seperti locale tidak boleh membedakan kedua kasus.
    const comparable = ({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest }: Record<string, unknown>) =>
      rest;
    expect(comparable(second.body.user)).toEqual(comparable(first.body.user));
    expect(second.body.token).toBeNull();
    expect(first.body.token).toBeNull();
    expect(second.body.user.id).not.toBe(existing?.id);
    expect(sessionCookie(first.headers["set-cookie"])).toBeDefined();
    expect(sessionCookie(second.headers["set-cookie"])).toBeUndefined();

    await expect
      .poll(() => queues.jobs)
      .toEqual([
        { queue: "email", payload: expect.objectContaining({ template: "auth.account_exists", userId: existing?.id }) },
      ]);
    const users = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
    expect(users).toHaveLength(1);
    const consents = await testDb.db
      .select()
      .from(schema.consents)
      .where(eq(schema.consents.userId, existing?.id ?? ""));
    expect(consents).toHaveLength(3);
  });

  it.each([
    ["password123", "too_common"],
    ["Password123", "too_common"],
    ["pendek1", "too_short"],
    ["x".repeat(129), "too_long"],
  ])("password %s ditolak WEAK_PASSWORD (%s) dengan pesan i18n; user tidak dibuat", async (password, reason) => {
    const email = uniqueEmail();
    const id = await signUp(app(), signUpBody(email, { password }));
    expect(id.status).toBe(422);
    expect(id.body.error).toMatchObject({ code: "WEAK_PASSWORD", details: { reason } });
    expect(id.body.error.message).toMatch(/Password minimal 8 karakter/);
    const en = await signUp(app(), signUpBody(email, { password }), { "accept-language": "en" });
    expect(en.body.error.message).toMatch(/at least 8 characters/);
    expect(await userByEmail(email)).toBeUndefined();
  });

  it.each([
    ["tanpa persetujuan S&K", { acceptTerms: undefined }, "acceptTerms"],
    ["persetujuan S&K false", { acceptTerms: false }, "acceptTerms"],
    ["email tidak valid", { email: "bukan-email" }, "email"],
    ["field asing (emailVerified)", { emailVerified: true }, ""],
    ["zona waktu tak dikenal", { timezone: "Mars/Olympus" }, "timezone"],
  ])("%s → 422 VALIDATION_FAILED", async (_label, extra, path) => {
    const email = uniqueEmail();
    const response = await signUp(app(), signUpBody(email, extra));
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.details.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
    expect(JSON.stringify(response.body)).not.toContain("Kue-Lapis");
    expect(await userByEmail(email)).toBeUndefined();
  });

  it("rate limit registrasi per IP: percobaan ke-4 dalam 1 jam → 429 + Retry-After (ACC-255)", async () => {
    const target = app();
    for (let attempt = 0; attempt < 3; attempt++) {
      expect((await signUp(target, signUpBody(uniqueEmail()))).status).toBe(200);
    }
    const blocked = await signUp(target, signUpBody(uniqueEmail()));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("header proxy rusak → IP consent null, registrasi tetap berhasil", async () => {
    const email = uniqueEmail();
    const response = await signUp(app(), signUpBody(email), { "x-forwarded-for": "bukan-ip" });
    expect(response.status).toBe(200);
    const user = await userByEmail(email);
    const rows = await testDb.db
      .select()
      .from(schema.consents)
      .where(eq(schema.consents.userId, user?.id ?? ""));
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.ip === null)).toBe(true);
  });
});
