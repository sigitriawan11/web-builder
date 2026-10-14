import { type Actor, eq, schema, workspaceScope } from "@platform/db";
import { createTestDb, createUser, type TestDb } from "@platform/db/testing";
import { dataEnvelope, ErrorBodySchema, listEnvelope, SiteSchema } from "@platform/shared/contracts";
import type { RequestHandler } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { silentLogger } from "../../test-utils";
import { createSitesRouter } from "./sites.routes";
import { createSitesService } from "./sites.service";

// Modul contoh (T1.4.7): CRUD minimal + isolasi tenant dengan Postgres asli. Middleware tenant di sini MENIRU
// tenantResolver (T1.5): user hanya mendapat tenant untuk workspace miliknya; role dari header khusus test.

let testDb: TestDb;
let alice: Awaited<ReturnType<typeof createUser>>;
let bob: Awaited<ReturnType<typeof createUser>>;

beforeAll(async () => {
  testDb = await createTestDb();
  alice = await createUser(testDb.db);
  bob = await createUser(testDb.db);
});
afterAll(async () => {
  await testDb.drop();
});

/** Request atas nama `user` dengan role tertentu di workspace pribadinya. */
function app() {
  const memberships = new Map([
    [alice.user.id, alice.workspace.id],
    [bob.user.id, bob.workspace.id],
  ]);
  const testTenant: RequestHandler = (req, _res, next) => {
    const userId = req.get("x-test-user") ?? "";
    const workspaceId = String(req.params.workspaceId);
    // Bukan anggota → 404 seperti tenantResolver (keberadaan workspace tidak bocor).
    if (memberships.get(userId) !== workspaceId) {
      next(Object.assign(new Error("not member"), { name: "AppError", code: "NOT_FOUND", status: 404 }));
      return;
    }
    const actor: Actor = { type: "user", userId, role: (req.get("x-test-role") ?? "owner") as "owner" };
    req.ctx.tenant = workspaceScope({ workspaceId, actor });
    next();
  };
  return createApp({
    logger: silentLogger(),
    mountRoutes: (app) => {
      app.use(
        "/v1/workspaces/:workspaceId/sites",
        createSitesRouter({ service: createSitesService({ db: testDb.db }), tenant: testTenant }),
      );
    },
  });
}

const as = (who: { user: { id: string } }) => ({ "x-test-user": who.user.id });
const sitesOf = (who: { workspace: { id: string } }) => `/v1/workspaces/${who.workspace.id}/sites`;

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
    const viewer = { ...as(alice), "x-test-role": "viewer" };
    expect((await request(app()).post(sitesOf(alice)).set(viewer).send({ name: "x" })).status).toBe(403);
    expect((await request(app()).get(sitesOf(alice)).set(viewer)).status).toBe(200);
  });

  it("billing tidak boleh melihat situs (403) — matriks ACC-033", async () => {
    const billing = { ...as(alice), "x-test-role": "billing" };
    expect((await request(app()).get(sitesOf(alice)).set(billing)).status).toBe(403);
  });

  it("editor: hapus situs buatannya boleh, buatan orang lain tidak (403); admin boleh", async () => {
    const editor = { ...as(alice), "x-test-role": "editor" };
    // Situs buatan "orang lain": dibuat lalu pembuatnya dikosongkan (pembuat tidak diketahui).
    const own = (await request(app()).post(sitesOf(alice)).set(editor).send({ name: "Punya Editor" })).body.data;
    const other = (await request(app()).post(sitesOf(alice)).set(as(alice)).send({ name: "Bukan Punya Editor" })).body
      .data;
    await testDb.db.update(schema.sites).set({ createdBy: null }).where(eq(schema.sites.id, other.id));

    expect(
      (
        await request(app())
          .delete(`${sitesOf(alice)}/${own.id}`)
          .set(editor)
      ).status,
    ).toBe(204);
    const denied = await request(app())
      .delete(`${sitesOf(alice)}/${other.id}`)
      .set(editor);
    expect(denied.status).toBe(403);
    expect(denied.body.error.details).toEqual({ action: "site.delete" });
    const admin = { ...as(alice), "x-test-role": "admin" };
    expect(
      (
        await request(app())
          .delete(`${sitesOf(alice)}/${other.id}`)
          .set(admin)
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
