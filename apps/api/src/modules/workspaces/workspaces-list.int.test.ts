import { eq, schema } from "@platform/db";
import { createTestDb, createUser, createWorkspace, type TestDb } from "@platform/db/testing";
import { listEnvelope, WorkspaceListItemSchema } from "@platform/shared/contracts";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authTestApp,
  recordingQueues,
  sessionCookie,
  signUpBody,
  TEST_ORIGIN,
  uniqueEmail,
} from "../../auth/auth.test-harness";

// T1.14.5: `GET /v1/workspaces` — daftar keanggotaan user login untuk switcher dashboard, termasuk isolasi tenant.
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

async function signedUpUser(app: ReturnType<typeof authTestApp>, name: string) {
  const email = uniqueEmail();
  const signUp = await request(app)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", uniqueIp())
    .send({ ...signUpBody(email), name });
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user) throw new Error("user tidak terbuat");
  return { user, cookie: sessionCookie(signUp.headers["set-cookie"]) ?? "" };
}

describe("GET /v1/workspaces", () => {
  it("personal dulu lalu tim (urut nama) dengan role; workspace user lain & yang dihapus tidak muncul (isolasi tenant)", async () => {
    const app = authTestApp(testDb, redis, recordingQueues());
    const sari = await signedUpUser(app, "Sari");
    const budi = await signedUpUser(app, "Budi");
    // Tim milik orang lain: Sari anggota editor di "Zeta", owner "Alfa"; "Dihapus" sudah dihapus; "Milik Budi" bukan miliknya.
    const { user: other } = await createUser(testDb.db);
    const zeta = await createWorkspace(testDb.db, { owner: other, name: "Zeta" });
    await testDb.db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: zeta.id, userId: sari.user.id, role: "editor" });
    await createWorkspace(testDb.db, { owner: sari.user, name: "Alfa" });
    const deleted = await createWorkspace(testDb.db, { owner: sari.user, name: "Dihapus" });
    await testDb.db
      .update(schema.workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(schema.workspaces.id, deleted.id));
    await createWorkspace(testDb.db, { owner: budi.user, name: "Milik Budi" });

    const response = await request(app).get("/v1/workspaces").set("cookie", sari.cookie);
    expect(response.status).toBe(200);
    const body = listEnvelope(WorkspaceListItemSchema).parse(response.body);
    expect(body.data.map(({ name, type, role }) => ({ name, type, role }))).toEqual([
      { name: expect.any(String), type: "personal", role: "owner" },
      { name: "Alfa", type: "team", role: "owner" },
      { name: "Zeta", type: "team", role: "editor" },
    ]);

    const budiList = await request(app).get("/v1/workspaces").set("cookie", budi.cookie);
    expect(budiList.body.data.map((workspace: { name: string }) => workspace.name)).not.toContain("Alfa");
    expect(budiList.body.data.map((workspace: { name: string }) => workspace.name)).toContain("Milik Budi");
  });

  it("tanpa sesi → 401; rute tenant `/v1/workspaces/:id/me` tetap berfungsi", async () => {
    const app = authTestApp(testDb, redis, recordingQueues());
    expect((await request(app).get("/v1/workspaces")).status).toBe(401);
    const sari = await signedUpUser(app, "Sari");
    const [first] = (await request(app).get("/v1/workspaces").set("cookie", sari.cookie)).body.data;
    const me = await request(app).get(`/v1/workspaces/${first.id}/me`).set("cookie", sari.cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe("owner");
  });
});
