import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { UUIDV7_PATTERN } from "@platform/shared";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { silentLogger } from "../test-utils";
import { createAuth } from "./auth";

// T1.5.1: Better Auth dengan Postgres & Redis asli.
const ORIGIN = "http://app.localhost:3000";
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

function app(client: Redis = redis) {
  const auth = createAuth({
    db: testDb.db,
    redis: client,
    logger: silentLogger(),
    config: {
      secret: "test-better-auth-secret-0123456789abcdef",
      publicAuthUrl: `${ORIGIN}/api/auth`,
      trustedOrigins: [ORIGIN],
      secureCookies: false,
    },
  });
  return createApp({ logger: silentLogger(), auth });
}

const email = () => `user.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@platform.test`;
const PASSWORD = "Kue-Lapis-2026!";
const sessionCookie = (setCookie: string[] | string | undefined) =>
  ([] as string[]).concat(setCookie ?? []).find((cookie) => cookie.startsWith("platform.session_token="));

async function signUp(target = app(), address = email()) {
  const response = await request(target)
    .post("/auth/sign-up/email")
    .set("origin", ORIGIN)
    .send({ name: "Budi Santoso", email: address, password: PASSWORD });
  return { response, address };
}

describe("Better Auth (ARCHITECTURE §9.1, ACC-004)", () => {
  it("sign-up: user UUIDv7 + akun credential ber-hash + sesi di Postgres & cache Redis", async () => {
    const { response, address } = await signUp();
    expect(response.status).toBe(200);
    const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, address));
    expect(user?.id).toMatch(UUIDV7_PATTERN);
    expect(user).toMatchObject({ locale: "id", timezone: "Asia/Jakarta", status: "active", emailVerified: false });

    const [account] = await testDb.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, user?.id ?? ""));
    expect(account?.providerId).toBe("credential");
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(PASSWORD);

    const sessions = await testDb.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, user?.id ?? ""));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toMatch(UUIDV7_PATTERN);
    const cached = await redis.get(`auth:${sessions[0]?.token}`);
    expect(cached).toContain(address);
    expect(await redis.ttl(`auth:${sessions[0]?.token}`)).toBeLessThanOrEqual(300);
  });

  it("cookie sesi: HttpOnly, SameSite=Lax, host-only; tanpa Secure di lokal", async () => {
    const cookie = sessionCookie((await signUp()).response.headers["set-cookie"]);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).not.toMatch(/;\s*Secure/i);
  });

  it("sign-in → sesi; get-session membaca user; password salah → 401", async () => {
    const target = app();
    const { address } = await signUp(target);
    const signIn = await request(target)
      .post("/auth/sign-in/email")
      .set("origin", ORIGIN)
      .send({ email: address, password: PASSWORD });
    expect(signIn.status).toBe(200);
    const cookie = sessionCookie(signIn.headers["set-cookie"])?.split(";")[0] ?? "";
    const session = await request(target).get("/auth/get-session").set("cookie", cookie);
    expect(session.body.user.email).toBe(address);

    const wrong = await request(target)
      .post("/auth/sign-in/email")
      .set("origin", ORIGIN)
      .send({ email: address, password: "salah-sekali-123" });
    expect(wrong.status).toBe(401);
  });

  it("sign-out menghapus sesi di Postgres DAN cache Redis", async () => {
    const target = app();
    const { response, address } = await signUp(target);
    const cookie = sessionCookie(response.headers["set-cookie"])?.split(";")[0] ?? "";
    const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, address));
    const [session] = await testDb.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, user?.id ?? ""));

    expect((await request(target).post("/auth/sign-out").set("origin", ORIGIN).set("cookie", cookie)).status).toBe(200);
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
    const { response, address } = await signUp(target);
    expect(response.status).toBe(200);
    const signIn = await request(target)
      .post("/auth/sign-in/email")
      .set("origin", ORIGIN)
      .send({ email: address, password: PASSWORD });
    const cookie = sessionCookie(signIn.headers["set-cookie"])?.split(";")[0] ?? "";
    expect((await request(target).get("/auth/get-session").set("cookie", cookie)).body.user.email).toBe(address);
  });

  it("CSRF: request ber-cookie dari origin tidak dipercaya ditolak, sesi tetap hidup (§9.1)", async () => {
    const target = app();
    const cookie = sessionCookie((await signUp(target)).response.headers["set-cookie"])?.split(";")[0] ?? "";
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
