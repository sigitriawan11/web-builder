import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EMAIL_VERIFICATION_EXPIRES_IN } from "./auth";
import {
  authTestApp,
  type RecordedJob,
  recordingQueues,
  sessionCookie,
  signUpBody,
  TEST_ORIGIN,
  uniqueEmail,
} from "./auth.test-harness";

// T1.5.3 (ACC-003): link bertoken + kode 6 digit dalam satu email via queue `email`, kirim ulang dengan cooldown.
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

interface VerifyJob {
  template: "auth.verify_email";
  userId: string;
  verifyUrl: string;
  code: string;
}

const verifyJobs = (jobs: RecordedJob[]) =>
  jobs.map((job) => job.payload as VerifyJob).filter((payload) => payload.template === "auth.verify_email");

/** URL publik (`app.…/api/auth/…`) → path API (`/auth/…`), seperti rewrite proxy web. */
const apiPath = (publicUrl: string) => {
  const url = new URL(publicUrl);
  return url.pathname.replace(/^\/api/, "") + url.search;
};

async function registered() {
  const queues = recordingQueues();
  const app = authTestApp(testDb, redis, queues);
  const email = uniqueEmail();
  const response = await request(app).post("/auth/sign-up/email").set("origin", TEST_ORIGIN).send(signUpBody(email));
  expect(response.status).toBe(200);
  await expect.poll(() => verifyJobs(queues.jobs)).toHaveLength(1);
  const [job] = verifyJobs(queues.jobs);
  if (!job) throw new Error("job verifikasi tidak ada");
  return { app, queues, email, job, cookie: sessionCookie(response.headers["set-cookie"]) ?? "" };
}

const isVerified = async (email: string) =>
  (await testDb.db.select().from(schema.users).where(eq(schema.users.email, email)))[0]?.emailVerified;

describe("verifikasi email (ACC-003)", () => {
  it("registrasi → satu email verifikasi: link publik ke /verify-email + kode 6 digit; user belum terverifikasi", async () => {
    const { job, email } = await registered();
    const url = new URL(job.verifyUrl);
    expect(url.origin + url.pathname).toBe(`${TEST_ORIGIN}/api/auth/verify-email`);
    expect(url.searchParams.get("callbackURL")).toBe("/verify-email");
    expect(job.code).toMatch(/^\d{6}$/);
    expect(await isVerified(email)).toBe(false);
  });

  it("klik link → terverifikasi & diarahkan ke halaman hasil di web", async () => {
    const { app, job, email } = await registered();
    const response = await request(app).get(apiPath(job.verifyUrl));
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/verify-email");
    expect(await isVerified(email)).toBe(true);
  });

  it("link kedaluwarsa (> 24 jam) → diarahkan ke halaman hasil dengan error, tetap belum terverifikasi", async () => {
    const { app, job, email } = await registered();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (EMAIL_VERIFICATION_EXPIRES_IN + 60) * 1000);
    const response = await request(app).get(apiPath(job.verifyUrl));
    expect(response.headers.location).toMatch(/^\/verify-email\?error=token_expired/i);
    vi.useRealTimers();
    expect(await isVerified(email)).toBe(false);
  });

  it("kode 6 digit → terverifikasi; kode hanya sekali pakai", async () => {
    const { app, job, email, cookie } = await registered();
    const verify = (otp: string) =>
      request(app)
        .post("/auth/email-otp/verify-email")
        .set("origin", TEST_ORIGIN)
        .set("cookie", cookie)
        .send({ email, otp });
    const first = await verify(job.code);
    expect(first.status).toBe(200);
    expect(await isVerified(email)).toBe(true);
    expect((await verify(job.code)).status).toBeGreaterThanOrEqual(400);
  });

  it("kode salah 3× → kode dibatalkan (kode benar pun ditolak)", async () => {
    const { app, job, email } = await registered();
    const wrong = job.code === "000000" ? "111111" : "000000";
    const verify = (otp: string) =>
      request(app).post("/auth/email-otp/verify-email").set("origin", TEST_ORIGIN).send({ email, otp });
    for (let attempt = 0; attempt < 3; attempt++) expect((await verify(wrong)).status).toBe(400);
    expect((await verify(job.code)).status).toBe(403);
    expect(await isVerified(email)).toBe(false);
  });

  it("kirim ulang: email & kode baru; cooldown 60 detik → 429 + Retry-After", async () => {
    const { app, queues, email, job } = await registered();
    const resend = () => request(app).post("/auth/send-verification-email").set("origin", TEST_ORIGIN).send({ email });
    expect((await resend()).status).toBe(200);
    await expect.poll(() => verifyJobs(queues.jobs)).toHaveLength(2);
    expect(verifyJobs(queues.jobs)[1]?.code).not.toBe(job.code);
    const blocked = await resend();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("kirim ulang untuk email tak terdaftar → 200 tanpa email (tidak membocorkan keberadaan akun)", async () => {
    const queues = recordingQueues();
    const response = await request(authTestApp(testDb, redis, queues))
      .post("/auth/send-verification-email")
      .set("origin", TEST_ORIGIN)
      .send({ email: uniqueEmail() });
    expect(response.status).toBe(200);
    expect(queues.jobs).toHaveLength(0);
  });

  it("endpoint OTP yang tidak dipakai dimatikan (login/reset/ganti email via OTP)", async () => {
    const app = authTestApp(testDb, redis);
    for (const path of [
      "/auth/sign-in/email-otp",
      "/auth/email-otp/send-verification-otp",
      "/auth/email-otp/reset-password",
    ]) {
      const response = await request(app)
        .post(path)
        .set("origin", TEST_ORIGIN)
        .send({ email: uniqueEmail(), otp: "123456" });
      expect(response.status, path).toBe(404);
    }
  });
});
