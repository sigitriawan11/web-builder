import { eq, schema } from "@platform/db";
import { createTestDb, createWorkspace, type TestDb } from "@platform/db/testing";
import type { WorkspaceRole } from "@platform/shared/contracts";
import { dataEnvelope, ErrorBodySchema, listEnvelope, SiteSchema } from "@platform/shared/contracts";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authTestApp, sessionCookie, signUpBody, TEST_ORIGIN, uniqueEmail } from "../../auth/auth.test-harness";

// Modul sites (T1.4.7) lewat jalur produksi penuh: sesi Better Auth → tenantResolver (keanggotaan & role dari
// `workspace_members`, T1.5.12) → izin ACC-033 → repository ber-scope tenant. Postgres & Redis asli.

interface TestUser {
  cookie: string;
  user: { id: string };
  workspace: { id: string };
}

let testDb: TestDb;
let redis: Redis;
let target: Express;
let alice: TestUser;
let bob: TestUser;
let ipCounter = 0;

/** Registrasi lewat API → sesi + personal workspace otomatis (ACC-030). */
async function register(): Promise<TestUser> {
  const email = uniqueEmail();
  const response = await request(target)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", `198.18.0.${(ipCounter++ % 250) + 1}`)
    .send(signUpBody(email));
  const [user] = await testDb.db.select().from(schema.users).where(eq(schema.users.email, email));
  const [workspace] = await testDb.db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerUserId, user?.id ?? ""));
  if (!user || !workspace) throw new Error("registrasi test gagal");
  return { cookie: sessionCookie(response.headers["set-cookie"]) ?? "", user, workspace };
}

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  target = authTestApp(testDb, redis);
  alice = await register();
  bob = await register();
});
afterAll(async () => {
  redis.disconnect();
  await testDb.drop();
});

const app = () => target;
const as = (who: TestUser) => ({ cookie: who.cookie, origin: TEST_ORIGIN });
const sitesOf = (who: { workspace: { id: string } }) => `/v1/workspaces/${who.workspace.id}/sites`;

/** Team workspace milik Alice dengan anggota baru ber-role `role` (role dari keanggotaan, bukan header). */
async function teamMember(role: WorkspaceRole) {
  const [aliceRow] = await testDb.db.select().from(schema.users).where(eq(schema.users.id, alice.user.id));
  if (!aliceRow) throw new Error("alice hilang");
  const team = await createWorkspace(testDb.db, { owner: aliceRow });
  const member = await register();
  await testDb.db.insert(schema.workspaceMembers).values({ workspaceId: team.id, userId: member.user.id, role });
  return { member, team: { workspace: team }, owner: alice };
}

describe("modul sites — CRUD (T1.4.7)", () => {
  it("create → get → rename → list → delete", async () => {
    const created = await request(app()).post(sitesOf(alice)).set(as(alice)).send({ name: "  Toko Kue Alice  " });
    expect(created.status).toBe(201);
    const site = dataEnvelope(SiteSchema).parse(created.body).data;
    expect(site).toMatchObject({ name: "Toko Kue Alice", status: "draft", workspaceId: alice.workspace.id });

    const fetched = await request(app())
      .get(`${sitesOf(alice)}/${site.id}`)
      .set(as(alice));
    expect(fetched.body.data).toEqual(site);

    const renamed = await request(app())
      .patch(`${sitesOf(alice)}/${site.id}`)
      .set(as(alice))
      .send({ name: "Kue Alice" });
    expect(renamed.body.data.name).toBe("Kue Alice");

    const listed = listEnvelope(SiteSchema).parse((await request(app()).get(sitesOf(alice)).set(as(alice))).body);
    expect(listed.data.map((item) => item.id)).toContain(site.id);

    expect(
      (
        await request(app())
          .delete(`${sitesOf(alice)}/${site.id}`)
          .set(as(alice))
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app())
          .get(`${sitesOf(alice)}/${site.id}`)
          .set(as(alice))
      ).status,
    ).toBe(404);
    const afterDelete = (await request(app()).get(sitesOf(alice)).set(as(alice))).body.data as { id: string }[];
    expect(afterDelete.map((item) => item.id)).not.toContain(site.id);
  });

  it("cursor pagination: halaman berurutan tanpa duplikat, halaman terakhir nextCursor null", async () => {
    for (let i = 0; i < 5; i++)
      await request(app())
        .post(sitesOf(bob))
        .set(as(bob))
        .send({ name: `Situs ${i}` });
    const first = (
      await request(app())
        .get(`${sitesOf(bob)}?limit=3`)
        .set(as(bob))
    ).body;
    expect(first.data).toHaveLength(3);
    const second = (
      await request(app())
        .get(`${sitesOf(bob)}?limit=3&cursor=${first.meta.nextCursor}`)
        .set(as(bob))
    ).body;
    expect(second.data).toHaveLength(2);
    expect(second.meta.nextCursor).toBeNull();
    const names = [...first.data, ...second.data].map((item: { name: string }) => item.name);
    expect(names).toEqual(["Situs 4", "Situs 3", "Situs 2", "Situs 1", "Situs 0"]);
    expect(
      (
        await request(app())
          .get(`${sitesOf(bob)}?cursor=rusak`)
          .set(as(bob))
      ).status,
    ).toBe(422);
  });
});

describe("modul sites — isolasi tenant (CLAUDE.md § Testing)", () => {
  it("Bob tidak bisa membaca/mengubah/menghapus situs Alice walau tahu ID-nya → 404", async () => {
    const site = (await request(app()).post(sitesOf(alice)).set(as(alice)).send({ name: "Rahasia Alice" })).body.data;
    // Lewat workspace Bob (tenant Bob, ID situs Alice): repository memfilter workspace_id.
    for (const call of [
      request(app()).get(`${sitesOf(bob)}/${site.id}`),
      request(app())
        .patch(`${sitesOf(bob)}/${site.id}`)
        .send({ name: "Dibajak" }),
      request(app()).delete(`${sitesOf(bob)}/${site.id}`),
    ]) {
      const response = await call.set(as(bob));
      expect(response.status).toBe(404);
      expect(ErrorBodySchema.parse(response.body).error.code).toBe("NOT_FOUND");
    }
    // Lewat workspace Alice dengan identitas Bob: ditolak middleware tenant.
    expect(
      (
        await request(app())
          .get(`${sitesOf(alice)}/${site.id}`)
          .set(as(bob))
      ).status,
    ).toBe(404);
    // Daftar Bob tidak memuat situs Alice; situs Alice tetap utuh.
    const bobList = (await request(app()).get(sitesOf(bob)).set(as(bob))).body.data as { id: string }[];
    expect(bobList.map((item) => item.id)).not.toContain(site.id);
    expect(
      (
        await request(app())
          .get(`${sitesOf(alice)}/${site.id}`)
          .set(as(alice))
      ).body.data.name,
    ).toBe("Rahasia Alice");
  });

  it("role viewer tidak boleh menulis (403), tetap boleh membaca", async () => {
    const { member, team } = await teamMember("viewer");
    expect((await request(app()).post(sitesOf(team)).set(as(member)).send({ name: "x" })).status).toBe(403);
    expect((await request(app()).get(sitesOf(team)).set(as(member))).status).toBe(200);
  });

  it("billing tidak boleh melihat situs (403) — matriks ACC-033", async () => {
    const { member, team } = await teamMember("billing");
    expect((await request(app()).get(sitesOf(team)).set(as(member))).status).toBe(403);
  });

  it("editor: hapus situs buatannya boleh, buatan orang lain tidak (403); admin boleh", async () => {
    const { member: editor, team, owner } = await teamMember("editor");
    const own = (await request(app()).post(sitesOf(team)).set(as(editor)).send({ name: "Punya Editor" })).body.data;
    const other = (await request(app()).post(sitesOf(team)).set(as(owner)).send({ name: "Bukan Punya Editor" })).body
      .data;

    expect(
      (
        await request(app())
          .delete(`${sitesOf(team)}/${own.id}`)
          .set(as(editor))
      ).status,
    ).toBe(204);
    const denied = await request(app())
      .delete(`${sitesOf(team)}/${other.id}`)
      .set(as(editor));
    expect(denied.status).toBe(403);
    expect(denied.body.error.details).toEqual({ action: "site.delete" });

    const admin = await register();
    await testDb.db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: team.workspace.id, userId: admin.user.id, role: "admin" });
    expect(
      (
        await request(app())
          .delete(`${sitesOf(team)}/${other.id}`)
          .set(as(admin))
      ).status,
    ).toBe(204);
  });

  it("validasi: nama kosong / siteId bukan UUID → 422", async () => {
    expect((await request(app()).post(sitesOf(alice)).set(as(alice)).send({ name: "   " })).status).toBe(422);
    expect(
      (
        await request(app())
          .get(`${sitesOf(alice)}/bukan-uuid`)
          .set(as(alice))
      ).status,
    ).toBe(422);
  });
});
