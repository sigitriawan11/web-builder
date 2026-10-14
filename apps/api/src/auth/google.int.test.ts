import { and, eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

// T1.5.6 (ACC-002): login Google lewat alur redirect sungguhan (`/sign-in/social` → `/callback/google`); hanya
// penukaran kode di endpoint token Google yang dipalsukan (fetch), sisanya Better Auth + Postgres + Redis asli.
const GOOGLE = { clientId: "test-client.apps.googleusercontent.com", clientSecret: "test-google-secret" };
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

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
  vi.restoreAllMocks();
});

let ipCounter = 0;
const uniqueIp = () => `192.0.2.${(ipCounter++ % 250) + 1}`;
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/** Endpoint token Google palsu: ID token berisi profil (tidak diverifikasi di alur callback — datang dari TLS Google). */
function fakeGoogle(profile: GoogleProfile) {
  const original = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(TOKEN_ENDPOINT)) return original(input, init);
    const now = Math.floor(Date.now() / 1000);
    const idToken = [
      base64url({ alg: "RS256", typ: "JWT" }),
      base64url({
        iss: "https://accounts.google.com",
        aud: GOOGLE.clientId,
        sub: profile.sub,
        email: profile.email,
        email_verified: profile.emailVerified,
        name: profile.name ?? "Siti Google",
        iat: now,
        exp: now + 3600,
      }),
      "signature",
    ].join(".");
    return Response.json({ access_token: "ya29.test", id_token: idToken, expires_in: 3600, token_type: "Bearer" });
  });
}

const app = (queues = recordingQueues()) => authTestApp(testDb, redis, queues, { google: GOOGLE });

/** Jalankan alur browser: minta URL otorisasi → kembali ke callback dengan state & cookie yang sama. */
async function loginWithGoogle(target: Express, profile: GoogleProfile, acceptLanguage = "id-ID") {
  fakeGoogle(profile);
  const ip = uniqueIp();
  const start = await request(target)
    .post("/auth/sign-in/social")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", ip)
    .send({ provider: "google", callbackURL: "/" });
  expect(start.status).toBe(200);
  const authorizeUrl = new URL(start.body.url);
  expect(authorizeUrl.origin).toBe("https://accounts.google.com");
  expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(`${TEST_ORIGIN}/api/auth/callback/google`);
  expect(authorizeUrl.searchParams.get("scope")?.split(" ").sort()).toEqual(["email", "openid", "profile"]);
  const cookies = ([] as string[]).concat(start.headers["set-cookie"] ?? []).map((cookie) => cookie.split(";")[0]);
  const callback = await request(target)
    .get(`/auth/callback/google?code=kode-uji&state=${authorizeUrl.searchParams.get("state")}`)
    .set("cookie", cookies.join("; "))
    .set("accept-language", acceptLanguage)
    .set("x-forwarded-for", ip);
  return { callback, cookie: sessionCookie(callback.headers["set-cookie"]) };
}

const userByEmail = async (email: string) =>
  (await testDb.db.select().from(schema.users).where(eq(schema.users.email, email)))[0];
const accountsOf = async (userId: string) =>
  (await testDb.db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId)))
    .map((account) => account.providerId)
    .sort();

async function passwordUser(target: Express, verified: boolean) {
  const email = uniqueEmail();
  await request(target)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", uniqueIp())
    .send(signUpBody(email));
  if (verified) await testDb.db.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.email, email));
  return email;
}

describe("login Google (ACC-002)", () => {
  it("user baru: dibuat terverifikasi (bisa publish), bahasa dari browser, sesi + audit; S&K belum disetujui", async () => {
    const target = app();
    const email = uniqueEmail();
    const { callback, cookie } = await loginWithGoogle(target, { sub: "g-1001", email, emailVerified: true }, "en-US");
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe("/");
    expect(cookie).toBeDefined();

    const user = await userByEmail(email);
    expect(user).toMatchObject({ emailVerified: true, locale: "en", name: "Siti Google" });
    expect(await accountsOf(user?.id ?? "")).toEqual(["google"]);
    // ACC-030: registrasi lewat Google juga mendapat personal workspace.
    const workspaces = await testDb.db
      .select()
      .from(schema.workspaces)
      .where(and(eq(schema.workspaces.ownerUserId, user?.id ?? ""), eq(schema.workspaces.type, "personal")));
    expect(workspaces).toHaveLength(1);
    const audit = await testDb.db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "auth.login"), eq(schema.auditLogs.actorId, user?.id ?? "")));
    expect(audit[0]?.metadata).toEqual({ method: "google" });

    // Layar persetujuan S&K pertama kali: status → setujui → tercatat versi berlaku.
    const status = await request(target)
      .get("/v1/account/consents")
      .set("cookie", cookie ?? "");
    expect(status.body.data.terms.accepted).toBe(false);
    const accept = await request(target)
      .post("/v1/account/consents")
      .set("origin", TEST_ORIGIN)
      .set("cookie", cookie ?? "")
      .send({ acceptTerms: true, marketingOptIn: false });
    expect(accept.status).toBe(200);
    expect(accept.body.data).toMatchObject({
      terms: { accepted: true },
      privacy: { accepted: true },
      marketing: { granted: false },
    });
  });

  it("email sama dengan akun password TERVERIFIKASI → Google ditautkan ke user yang sama", async () => {
    const queues = recordingQueues();
    const target = app(queues);
    const email = await passwordUser(target, true);
    const before = await userByEmail(email);
    const { callback, cookie } = await loginWithGoogle(target, { sub: "g-2002", email, emailVerified: true });
    expect(callback.status).toBe(302);
    expect(cookie).toBeDefined();
    expect(await accountsOf(before?.id ?? "")).toEqual(["credential", "google"]);
    // Menautkan ke user lama: tidak ada email sambutan kedua (hanya dari registrasi awal) ...
    await new Promise((resolve) => setTimeout(resolve, 100));
    const welcomes = queues.jobs.filter((job) => (job.payload as { template?: string }).template === "auth.welcome");
    expect(welcomes).toHaveLength(1);
    // ... dan tidak membuat workspace kedua.
    const workspaces = await testDb.db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.ownerUserId, before?.id ?? ""));
    expect(workspaces).toHaveLength(1);
  });

  it("email sama dengan akun password BELUM terverifikasi → ditolak, tidak ditautkan (cegah takeover)", async () => {
    const target = app();
    const email = await passwordUser(target, false);
    const user = await userByEmail(email);
    const { callback, cookie } = await loginWithGoogle(target, { sub: "g-3003", email, emailVerified: true });
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(`${TEST_ORIGIN}/login?error=account_not_linked`);
    expect(cookie).toBeUndefined();
    expect(await accountsOf(user?.id ?? "")).toEqual(["credential"]);
  });

  it("Google menyatakan email belum terverifikasi → tidak ditautkan ke akun lokal terverifikasi", async () => {
    const target = app();
    const email = await passwordUser(target, true);
    const user = await userByEmail(email);
    const { cookie } = await loginWithGoogle(target, { sub: "g-4004", email, emailVerified: false });
    expect(cookie).toBeUndefined();
    expect(await accountsOf(user?.id ?? "")).toEqual(["credential"]);
  });

  it("memutus tautan Google: ditolak bila satu-satunya metode login; boleh bila password ada", async () => {
    const target = app();
    const googleOnly = await loginWithGoogle(target, { sub: "g-5005", email: uniqueEmail(), emailVerified: true });
    const unlink = (cookie: string, accountId: string) =>
      request(target)
        .post("/auth/unlink-account")
        .set("origin", TEST_ORIGIN)
        .set("cookie", cookie)
        .send({ providerId: "google", accountId });
    const last = await unlink(googleOnly.cookie ?? "", "apa-saja");
    expect(last.status).toBe(400);
    expect(last.body.code).toBe("FAILED_TO_UNLINK_LAST_ACCOUNT");

    const email = await passwordUser(target, true);
    const linked = await loginWithGoogle(target, { sub: "g-6006", email, emailVerified: true });
    const list = await request(target)
      .get("/auth/list-accounts")
      .set("cookie", linked.cookie ?? "");
    expect(list.body.map((account: { providerId: string }) => account.providerId).sort()).toEqual([
      "credential",
      "google",
    ]);
    // `accountId` unlink BA = id baris akun dari daftar akun (seperti UI Pengaturan > Keamanan), bukan id Google.
    const googleAccount = list.body.find((account: { providerId: string }) => account.providerId === "google");
    expect((await unlink(linked.cookie ?? "", googleAccount.id)).status).toBe(200);
    const user = await userByEmail(email);
    expect(await accountsOf(user?.id ?? "")).toEqual(["credential"]);
    // Masih bisa login dengan password.
    const signIn = await request(target)
      .post("/auth/sign-in/email")
      .set("origin", TEST_ORIGIN)
      .set("x-forwarded-for", uniqueIp())
      .send({ email, password: STRONG_PASSWORD });
    expect(signIn.status).toBe(200);
  });

  it("user Google-only memasang password lewat alur reset (ACC-005) → bisa login email + password", async () => {
    const queues = recordingQueues();
    const target = app(queues);
    const email = uniqueEmail();
    await loginWithGoogle(target, { sub: "g-7007", email, emailVerified: true });
    await request(target)
      .post("/auth/request-password-reset")
      .set("origin", TEST_ORIGIN)
      .set("x-forwarded-for", uniqueIp())
      .send({ email });
    const resetJob = () =>
      queues.jobs
        .map((job: RecordedJob) => job.payload as { template?: string; resetUrl?: string })
        .find((payload) => payload.template === "auth.password_reset");
    await expect.poll(resetJob).toBeDefined();
    const token = decodeURIComponent(new URL(resetJob()?.resetUrl ?? "").pathname.split("/").pop() ?? "");
    const reset = await request(target)
      .post("/auth/reset-password")
      .set("origin", TEST_ORIGIN)
      .set("x-forwarded-for", uniqueIp())
      .send({ token, newPassword: STRONG_PASSWORD });
    expect(reset.status).toBe(200);
    const user = await userByEmail(email);
    expect(await accountsOf(user?.id ?? "")).toEqual(["credential", "google"]);
    const signIn = await request(target)
      .post("/auth/sign-in/email")
      .set("origin", TEST_ORIGIN)
      .set("x-forwarded-for", uniqueIp())
      .send({ email, password: STRONG_PASSWORD });
    expect(signIn.status).toBe(200);
  });

  it("redirect URI lokal (localhost polos, diteruskan web ke app.localhost): authorize & tukar kode memakai URI yang sama", async () => {
    const redirectUri = "http://localhost:3000/api/auth/callback/google";
    const target = authTestApp(testDb, redis, undefined, { google: { ...GOOGLE, redirectUri } });
    const exchanged: string[] = [];
    fakeGoogle({ sub: "g-8008", email: uniqueEmail(), emailVerified: true });
    const fakeFetch = vi.mocked(globalThis.fetch);
    const inner = fakeFetch.getMockImplementation();
    fakeFetch.mockImplementation(async (input, init) => {
      if (String(input).startsWith(TOKEN_ENDPOINT)) exchanged.push(String(init?.body));
      return inner ? inner(input, init) : Response.error();
    });
    const start = await request(target)
      .post("/auth/sign-in/social")
      .set("origin", TEST_ORIGIN)
      .send({ provider: "google", callbackURL: "/" });
    const authorizeUrl = new URL(start.body.url);
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(redirectUri);
    // Browser tiba di app.localhost (setelah diteruskan web) dengan cookie state miliknya.
    const cookies = ([] as string[]).concat(start.headers["set-cookie"] ?? []).map((cookie) => cookie.split(";")[0]);
    const callback = await request(target)
      .get(`/auth/callback/google?code=kode-uji&state=${authorizeUrl.searchParams.get("state")}`)
      .set("cookie", cookies.join("; "));
    expect(sessionCookie(callback.headers["set-cookie"])).toBeDefined();
    expect(exchanged.some((body) => body.includes(encodeURIComponent(redirectUri)))).toBe(true);
  });

  it("tanpa kredensial Google → provider tidak tersedia", async () => {
    const response = await request(authTestApp(testDb, redis))
      .post("/auth/sign-in/social")
      .set("origin", TEST_ORIGIN)
      .send({ provider: "google", callbackURL: "/" });
    expect(response.status).toBe(404);
  });

  it("/v1/account/consents tanpa sesi → 401", async () => {
    expect((await request(app()).get("/v1/account/consents")).status).toBe(401);
  });
});
