import { and, eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authTestApp,
  type RecordedJob,
  recordingQueues,
  STRONG_PASSWORD,
  sessionCookie,
  signUpBody,
  TEST_ORIGIN,
  uniqueEmail,
} from "../../auth/auth.test-harness";

// T1.5.8 (ACC-008): profil, ganti email (re-auth + verifikasi alamat baru), ganti password dengan notifikasi.
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
const uniqueIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;
const apiPath = (publicUrl: string) => {
  const url = new URL(publicUrl);
  return url.pathname.replace(/^\/api/, "") + url.search;
};

async function setup() {
  const queues = recordingQueues();
  const app = authTestApp(testDb, redis, queues);
  const email = uniqueEmail();
  const ip = uniqueIp();
  const signUp = await request(app)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", ip)
    .send(signUpBody(email));
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  return { app, queues, email, ip, userId: user?.id ?? "", cookie: sessionCookie(signUp.headers["set-cookie"]) ?? "" };
}

const jobsOf = (jobs: RecordedJob[], template: string) =>
  jobs.map((job) => job.payload as Record<string, string | undefined>).filter((p) => p.template === template);
const post = (app: Express, path: string, cookie: string, body: Record<string, unknown>, ip = uniqueIp()) =>
  request(app).post(path).set("origin", TEST_ORIGIN).set("x-forwarded-for", ip).set("cookie", cookie).send(body);
const signIn = (app: Express, email: string, password = STRONG_PASSWORD) =>
  request(app)
    .post("/auth/sign-in/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", uniqueIp())
    .send({ email, password });

describe("profil (ACC-008)", () => {
  it("GET profil: field lengkap; avatar null (inisial) sampai pipeline aset T2.12.1", async () => {
    const { app, cookie, email } = await setup();
    const response = await request(app).get("/v1/account/profile").set("cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      name: "Budi Santoso",
      email,
      emailVerified: false,
      image: null,
      timezone: "Asia/Jakarta",
      hasPassword: true,
    });
  });

  it("PATCH nama → tersimpan & sesi langsung memuat nama baru (cache Redis ikut diperbarui)", async () => {
    const { app, cookie } = await setup();
    const update = await request(app)
      .patch("/v1/account/profile")
      .set("origin", TEST_ORIGIN)
      .set("cookie", cookie)
      .send({ name: "  Budi Hartono " });
    expect(update.status).toBe(200);
    expect(update.body.data.name).toBe("Budi Hartono");
    expect((await request(app).get("/auth/get-session").set("cookie", cookie)).body.user.name).toBe("Budi Hartono");
  });

  it("PATCH bahasa & zona waktu (ACC-009) → tersimpan di user (dipakai email berikutnya & tampilan tanggal)", async () => {
    const { app, cookie, userId } = await setup();
    const update = await request(app)
      .patch("/v1/account/profile")
      .set("origin", TEST_ORIGIN)
      .set("cookie", cookie)
      .send({ locale: "en", timezone: "Asia/Makassar" });
    expect(update.status).toBe(200);
    expect(update.body.data).toMatchObject({ locale: "en", timezone: "Asia/Makassar" });
    const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user).toMatchObject({ locale: "en", timezone: "Asia/Makassar" });
  });

  it.each([
    ["bahasa tidak didukung", { locale: "fr" }],
    ["zona waktu tak dikenal", { timezone: "Mars/Olympus" }],
    ["body kosong", {}],
    ["nama kosong", { name: "   " }],
    ["field asing (image)", { image: "https://pelacak.example/x.png" }],
  ])("PATCH %s → 422", async (_label, body) => {
    const { app, cookie } = await setup();
    const response = await request(app)
      .patch("/v1/account/profile")
      .set("origin", TEST_ORIGIN)
      .set("cookie", cookie)
      .send(body);
    expect(response.status).toBe(422);
  });

  it("/auth/update-user bawaan BA dimatikan (bisa mengisi image sembarang)", async () => {
    const { app, cookie } = await setup();
    const response = await post(app, "/auth/update-user", cookie, { image: "https://pelacak.example/x.png" });
    expect(response.status).toBe(404);
  });
});

describe("ganti email (ACC-008, ACC-003)", () => {
  it("tanpa / salah password → 403 REAUTH_REQUIRED, tidak ada email", async () => {
    const { app, cookie, queues } = await setup();
    const missing = await post(app, "/auth/change-email", cookie, { newEmail: uniqueEmail() });
    expect(missing.status).toBe(403);
    expect(missing.body.error).toMatchObject({ code: "REAUTH_REQUIRED", details: { method: "password" } });
    const wrong = await post(app, "/auth/change-email", cookie, {
      newEmail: uniqueEmail(),
      password: "salah-sekali-1",
    });
    expect(wrong.body.error.code).toBe("REAUTH_REQUIRED");
    expect(jobsOf(queues.jobs, "auth.verify_email")).toHaveLength(1); // hanya dari registrasi
  });

  it("password benar → verifikasi ke alamat BARU; email lama tetap aktif sampai link diklik", async () => {
    const { app, cookie, queues, email } = await setup();
    const newEmail = uniqueEmail();
    const response = await post(app, "/auth/change-email", cookie, {
      newEmail: `  ${newEmail.toUpperCase()} `,
      password: STRONG_PASSWORD,
    });
    expect(response.status).toBe(200);
    await expect.poll(() => jobsOf(queues.jobs, "auth.verify_email")).toHaveLength(2);
    const job = jobsOf(queues.jobs, "auth.verify_email")[1];
    expect(job).toMatchObject({ email: newEmail });
    expect(job?.code).toBeUndefined();

    // Belum diklik: email lama masih berlaku.
    expect((await signIn(app, email)).status).toBe(200);
    expect((await signIn(app, newEmail)).status).toBe(401);

    const verify = await request(app).get(apiPath(job?.verifyUrl ?? ""));
    expect(verify.status).toBe(302);
    const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, newEmail));
    expect(user).toMatchObject({ email: newEmail, emailVerified: true });
    expect((await signIn(app, newEmail)).status).toBe(200);
    expect((await signIn(app, email)).status).toBe(401);
  });

  it("alamat baru sudah dipakai akun lain → respons sukses generik, tanpa email (tidak membocorkan)", async () => {
    const { app, cookie, queues } = await setup();
    const other = await setup();
    const response = await post(app, "/auth/change-email", cookie, {
      newEmail: other.email,
      password: STRONG_PASSWORD,
    });
    expect(response.status).toBe(200);
    expect(jobsOf(queues.jobs, "auth.verify_email")).toHaveLength(1);
  });

  it("akun tanpa password (Google-only): login baru boleh, login lama (> 10 menit) → REAUTH fresh_login", async () => {
    const { app, cookie, userId } = await setup();
    await testDb.db
      .delete(schema.accounts)
      .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.providerId, "credential")));
    expect((await post(app, "/auth/change-email", cookie, { newEmail: uniqueEmail() })).status).toBe(200);

    await testDb.db
      .update(schema.sessions)
      .set({ createdAt: new Date(Date.now() - 60 * 60_000) })
      .where(eq(schema.sessions.userId, userId));
    // Cache sesi Redis (`auth:<token>`) masih menyimpan createdAt baru → hapus agar BA membaca Postgres.
    const tokens = await testDb.db
      .select({ token: schema.sessions.token })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId));
    await redis.del(...tokens.map((row) => `auth:${row.token}`));
    const stale = await post(app, "/auth/change-email", cookie, { newEmail: uniqueEmail() });
    expect(stale.status).toBe(403);
    expect(stale.body.error.details).toEqual({ method: "fresh_login" });
  });
});

describe("ganti password dari pengaturan (ACC-005)", () => {
  it("berhasil → email 'password diubah' + audit; password lemah → 422", async () => {
    const { app, cookie, queues, userId, email } = await setup();
    const weak = await post(app, "/auth/change-password", cookie, {
      currentPassword: STRONG_PASSWORD,
      newPassword: "password123",
    });
    expect(weak.status).toBe(422);

    const changed = await post(app, "/auth/change-password", cookie, {
      currentPassword: STRONG_PASSWORD,
      newPassword: "Rendang-Baru-2026!",
      revokeOtherSessions: true,
    });
    expect(changed.status).toBe(200);
    await expect.poll(() => jobsOf(queues.jobs, "auth.password_changed")).toHaveLength(1);
    const audit = await testDb.db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "auth.password_change"), eq(schema.auditLogs.actorId, userId)));
    expect(audit[0]?.metadata).toEqual({ revokeOtherSessions: true });
    expect((await signIn(app, email, "Rendang-Baru-2026!")).status).toBe(200);
  });

  it("password lama salah → tanpa email notifikasi", async () => {
    const { app, cookie, queues } = await setup();
    const response = await post(app, "/auth/change-password", cookie, {
      currentPassword: "salah-sekali-1",
      newPassword: "Rendang-Baru-2026!",
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(jobsOf(queues.jobs, "auth.password_changed")).toHaveLength(0);
  });
});
