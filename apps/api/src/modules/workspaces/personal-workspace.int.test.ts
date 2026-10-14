import { and, eq, isNull, schema, sql } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authTestApp,
  type RecordedJob,
  recordingQueues,
  signUpBody,
  TEST_ORIGIN,
  uniqueEmail,
} from "../../auth/auth.test-harness";

// T1.5.10 (ACC-030): personal workspace dibuat bersama user (transaksi yang sama) + email sambutan.
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
const uniqueIp = () => `192.0.2.${(ipCounter++ % 250) + 1}`;
const welcomeJobs = (jobs: RecordedJob[]) =>
  jobs.map((job) => job.payload as { template?: string; userId?: string }).filter((p) => p.template === "auth.welcome");

async function signUp(email: string, queues = recordingQueues()) {
  const response = await request(authTestApp(testDb, redis, queues))
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", uniqueIp())
    .send(signUpBody(email));
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  return { response, user, queues };
}

const personalWorkspacesOf = (userId: string) =>
  testDb.db
    .select()
    .from(schema.workspaces)
    .where(and(eq(schema.workspaces.ownerUserId, userId), eq(schema.workspaces.type, "personal")));

describe("personal workspace otomatis (ACC-030)", () => {
  it("registrasi → tepat 1 personal workspace 'Workspace {nama}', slug ws_…, user = owner; email sambutan", async () => {
    const { user, queues } = await signUp(uniqueEmail());
    const workspaces = await personalWorkspacesOf(user?.id ?? "");
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toMatchObject({ name: "Workspace Budi Santoso", status: "active" });
    expect(workspaces[0]?.slug).toMatch(/^ws_[a-z0-9]{10}$/);

    const members = await testDb.db
      .select()
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.workspaceId, workspaces[0]?.id ?? ""));
    expect(members).toEqual([expect.objectContaining({ userId: user?.id, role: "owner" })]);
    await expect
      .poll(() => welcomeJobs(queues.jobs))
      .toEqual([{ template: "auth.welcome", userId: user?.id, requestId: expect.any(String) }]);
  });

  it("daftar ulang dengan email terdaftar → tidak ada workspace baru & tidak ada email sambutan", async () => {
    const email = uniqueEmail();
    const first = await signUp(email);
    const second = await signUp(email);
    expect(await personalWorkspacesOf(first.user?.id ?? "")).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(welcomeJobs(second.queues.jobs)).toHaveLength(0);
  });

  it("tidak ada user tanpa personal workspace (invarian ACC-030)", async () => {
    for (let index = 0; index < 3; index++) await signUp(uniqueEmail());
    const orphans = await testDb.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .leftJoin(
        schema.workspaces,
        and(eq(schema.workspaces.ownerUserId, schema.users.id), eq(schema.workspaces.type, "personal")),
      )
      .where(isNull(schema.workspaces.id));
    expect(orphans).toEqual([]);
    const [{ count } = { count: 0 }] = await testDb.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.type, "personal"));
    const [{ users } = { users: 0 }] = await testDb.db.select({ users: sql<number>`count(*)::int` }).from(schema.users);
    expect(count).toBe(users);
  });
});
