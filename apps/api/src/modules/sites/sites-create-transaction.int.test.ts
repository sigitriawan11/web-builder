import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { authTestApp, sessionCookie, signUpBody, TEST_ORIGIN, uniqueEmail } from "../../auth/auth.test-harness";

// T1.6.2: situs + dokumen + snapshot awal dalam SATU transaksi → gagal menulis dokumen awal = tidak ada situs.
vi.mock("./sites.repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sites.repository")>()),
  writeInitialDocument: vi.fn(async () => {
    throw new Error("simulasi gagal menulis dokumen awal");
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

it("gagal menulis dokumen awal → situs & dokumen tidak tersimpan", async () => {
  const app = authTestApp(testDb, redis);
  const email = uniqueEmail();
  const signUp = await request(app).post("/auth/sign-up/email").set("origin", TEST_ORIGIN).send(signUpBody(email));
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  const [workspace] = await testDb.db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerUserId, user?.id ?? ""));

  const response = await request(app)
    .post(`/v1/workspaces/${workspace?.id}/sites`)
    .set("origin", TEST_ORIGIN)
    .set("cookie", sessionCookie(signUp.headers["set-cookie"]) ?? "")
    .send({ name: "Gagal" });
  expect(response.status).toBe(500);
  expect(await testDb.db.select().from(schema.sites)).toHaveLength(0);
  expect(await testDb.db.select().from(schema.documents)).toHaveLength(0);
});
