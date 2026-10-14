import { and, eq, schema } from "@platform/db";
import { createSite, createTestDb, createWorkspace, type TestDb } from "@platform/db/testing";
import { permissionsFor, uuidv7 } from "@platform/shared";
import { WorkspaceMeSchema } from "@platform/shared/contracts";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authTestApp, sessionCookie, signUpBody, TEST_ORIGIN, uniqueEmail } from "../auth/auth.test-harness";
import { requireAuth } from "./auth-session";
import { tenantResolver } from "./tenant-resolver";

// T1.5.12 (ARCHITECTURE §5.3, §9.5): keanggotaan + role → req.ctx.tenant; akses lintas tenant = 404.
let testDb: TestDb;
let redis: Redis;
let target: Express;
let ipCounter = 0;

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  target = authTestApp(testDb, redis, undefined, {
    // Rute uji cakupan situs (rute `/v1/sites/:siteId/*` produksi menyusul bersama fiturnya).
    mountRoutes: (app) => {
      app.get("/v1/sites/:siteId/ping", requireAuth(), tenantResolver({ db: testDb.db, scope: "site" }), (req, res) => {
        res.json({ data: req.ctx.tenant });
      });
    },
  });
});
afterAll(async () => {
  redis.disconnect();
  await testDb.drop();
});

async function register() {
  const email = uniqueEmail();
  const response = await request(target)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", `198.18.1.${(ipCounter++ % 250) + 1}`)
    .send(signUpBody(email));
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  const [workspace] = await testDb.db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerUserId, user?.id ?? ""));
  if (!user || !workspace) throw new Error("registrasi gagal");
  return { cookie: sessionCookie(response.headers["set-cookie"]) ?? "", user, workspace };
}

const me = (workspaceId: string, cookie?: string) => {
  const call = request(target).get(`/v1/workspaces/${workspaceId}/me`);
  return cookie ? call.set("cookie", cookie) : call;
};

describe("tenantResolver — workspace", () => {
  it("tanpa sesi → 401 (sebelum memeriksa keanggotaan)", async () => {
    const alice = await register();
    expect((await me(alice.workspace.id)).status).toBe(401);
    expect((await request(target).get(`/v1/workspaces/${alice.workspace.id}/sites`)).status).toBe(401);
  });

  it("anggota: /me → workspace, role owner, semua izin", async () => {
    const alice = await register();
    const response = await me(alice.workspace.id, alice.cookie);
    expect(response.status).toBe(200);
    const data = WorkspaceMeSchema.parse(response.body.data);
    expect(data).toMatchObject({ workspace: { id: alice.workspace.id, type: "personal" }, role: "owner" });
    expect(data.permissions).toEqual(permissionsFor("owner"));
  });

  it("role dari keanggotaan: viewer di team workspace → izin viewer", async () => {
    const alice = await register();
    const bob = await register();
    const team = await createWorkspace(testDb.db, { owner: alice.user });
    await testDb.db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: team.id, userId: bob.user.id, role: "viewer" });
    const data = (await me(team.id, bob.cookie)).body.data;
    expect(data.role).toBe("viewer");
    expect(data.permissions).toEqual(permissionsFor("viewer"));
  });

  it.each([
    ["workspace user lain", "other"],
    ["UUID acak", "random"],
    ["ID bukan UUID", "invalid"],
  ])("%s → 404 NOT_FOUND (keberadaan tidak bocor)", async (_label, kind) => {
    const alice = await register();
    const bob = await register();
    const id = kind === "other" ? bob.workspace.id : kind === "random" ? uuidv7() : "bukan-uuid";
    const response = await me(id, alice.cookie);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("workspace dihapus (soft delete) → 404", async () => {
    const alice = await register();
    await testDb.db
      .update(schema.workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(schema.workspaces.id, alice.workspace.id));
    expect((await me(alice.workspace.id, alice.cookie)).status).toBe(404);
  });

  it("keanggotaan dicabut → langsung 404 (tidak ada cache keanggotaan)", async () => {
    const alice = await register();
    const bob = await register();
    const team = await createWorkspace(testDb.db, { owner: alice.user });
    await testDb.db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: team.id, userId: bob.user.id, role: "editor" });
    expect((await me(team.id, bob.cookie)).status).toBe(200);
    await testDb.db
      .delete(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.workspaceId, team.id), eq(schema.workspaceMembers.userId, bob.user.id)));
    expect((await me(team.id, bob.cookie)).status).toBe(404);
  });
});

describe("tenantResolver — situs", () => {
  it("anggota workspace pemilik situs → tenant situs dengan role; bukan anggota / situs dihapus → 404", async () => {
    const alice = await register();
    const bob = await register();
    const { site } = await createSite(testDb.db, { workspace: alice.workspace });
    const ping = (cookie: string) => request(target).get(`/v1/sites/${site.id}/ping`).set("cookie", cookie);

    const own = await ping(alice.cookie);
    expect(own.status).toBe(200);
    expect(own.body.data).toMatchObject({
      kind: "site",
      siteId: site.id,
      workspaceId: alice.workspace.id,
      actor: { type: "user", userId: alice.user.id, role: "owner" },
    });
    expect((await ping(bob.cookie)).status).toBe(404);

    await testDb.db.update(schema.sites).set({ deletedAt: new Date() }).where(eq(schema.sites.id, site.id));
    expect((await ping(alice.cookie)).status).toBe(404);
  });
});
