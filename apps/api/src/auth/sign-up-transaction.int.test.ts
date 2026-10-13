import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { authTestApp, signUpBody, TEST_ORIGIN, uniqueEmail } from "./auth.test-harness";

// ACC-001: consent ditulis dalam transaksi yang sama dengan user → gagal menulis consent = user tidak tersimpan.
vi.mock("./auth.repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth.repository")>()),
  insertConsents: vi.fn(async () => {
    throw new Error("simulasi gagal menulis consent");
  }),
}));

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

it("gagal menulis consent → seluruh registrasi di-rollback (tanpa user, akun, sesi)", async () => {
  const email = uniqueEmail();
  const response = await request(authTestApp(testDb, redis))
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .send(signUpBody(email));
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.headers["set-cookie"] ?? []).not.toEqual(
    expect.arrayContaining([expect.stringMatching(/^platform\.session_token=[^;]/)]),
  );
  expect(await testDb.db.select().from(schema.users).where(eq(schema.users.email, email))).toHaveLength(0);
  expect(await testDb.db.select().from(schema.accounts)).toHaveLength(0);
  expect(await testDb.db.select().from(schema.sessions)).toHaveLength(0);
});
