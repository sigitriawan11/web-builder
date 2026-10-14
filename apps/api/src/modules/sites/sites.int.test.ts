import { eq, inArray, schema, sql } from "@platform/db";
import { createTestDb, createWorkspace, type TestDb } from "@platform/db/testing";
import { CURRENT_SCHEMA_VERSION, SiteDocumentSchema, siteDocumentFromState } from "@platform/document-model";
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
const siteUrl = (siteId: string | undefined) => `/v1/sites/${siteId}`;

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

    const fetched = await request(app()).get(siteUrl(site.id)).set(as(alice));
    expect(fetched.body.data).toEqual(site);

    const renamed = await request(app()).patch(siteUrl(site.id)).set(as(alice)).send({ name: "Kue Alice" });
    expect(renamed.body.data.name).toBe("Kue Alice");

    const listed = listEnvelope(SiteSchema).parse((await request(app()).get(sitesOf(alice)).set(as(alice))).body);
    expect(listed.data.map((item) => item.id)).toContain(site.id);

    expect((await request(app()).delete(siteUrl(site.id)).set(as(alice))).status).toBe(204);
    expect((await request(app()).get(siteUrl(site.id)).set(as(alice))).status).toBe(404);
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
    // Rute level situs: tenantResolver (cakupan situs) menolak karena Bob bukan anggota workspace Alice.
    for (const call of [
      request(app()).get(siteUrl(site.id)),
      request(app()).patch(siteUrl(site.id)).send({ name: "Dibajak" }),
      request(app()).delete(siteUrl(site.id)),
    ]) {
      const response = await call.set(as(bob));
      expect(response.status).toBe(404);
      expect(ErrorBodySchema.parse(response.body).error.code).toBe("NOT_FOUND");
    }
    // Daftar Bob tidak memuat situs Alice; situs Alice tetap utuh.
    const bobList = (await request(app()).get(sitesOf(bob)).set(as(bob))).body.data as { id: string }[];
    expect(bobList.map((item) => item.id)).not.toContain(site.id);
    expect((await request(app()).get(siteUrl(site.id)).set(as(alice))).body.data.name).toBe("Rahasia Alice");
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

    expect((await request(app()).delete(siteUrl(own.id)).set(as(editor))).status).toBe(204);
    const denied = await request(app()).delete(siteUrl(other.id)).set(as(editor));
    expect(denied.status).toBe(403);
    expect(denied.body.error.details).toEqual({ action: "site.delete" });

    const admin = await register();
    await testDb.db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: team.workspace.id, userId: admin.user.id, role: "admin" });
    expect((await request(app()).delete(siteUrl(other.id)).set(as(admin))).status).toBe(204);
  });

  it("validasi: nama kosong → 422; siteId bukan UUID → 404 (tenantResolver, tidak bocor)", async () => {
    expect((await request(app()).post(sitesOf(alice)).set(as(alice)).send({ name: "   " })).status).toBe(422);
    expect((await request(app()).get(siteUrl("bukan-uuid")).set(as(alice))).status).toBe(404);
  });
});

describe("daftar situs dashboard (T1.6.1, ACC-050)", () => {
  /** User baru (workspace kosong) + situs bernama `names`, dibuat berurutan. */
  async function workspaceWith(names: string[]) {
    const owner = await register();
    const ids: string[] = [];
    for (const name of names) {
      ids.push((await request(app()).post(sitesOf(owner)).set(as(owner)).send({ name })).body.data.id);
    }
    return { owner, ids };
  }

  /** Semua halaman sampai habis; gagal bila ada ID ganda. */
  async function allPages(owner: TestUser, params: string, limit = 2) {
    const names: string[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const query: string = `${params}&limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`;
      const body: { data: { id: string; name: string }[]; meta: { nextCursor: string | null } } = (
        await request(app())
          .get(`${sitesOf(owner)}?${query}`)
          .set(as(owner))
      ).body;
      for (const item of body.data as { id: string; name: string }[]) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
        names.push(item.name);
      }
      cursor = body.meta.nextCursor;
    } while (cursor);
    return names;
  }

  it("filter status: semua (tanpa arsip) / published / draft / arsip", async () => {
    const { owner, ids } = await workspaceWith(["Draf", "Terbit", "Arsip"]);
    await testDb.db
      .update(schema.sites)
      .set({ status: "published" })
      .where(eq(schema.sites.id, ids[1] ?? ""));
    await testDb.db
      .update(schema.sites)
      .set({ status: "archived" })
      .where(eq(schema.sites.id, ids[2] ?? ""));
    const names = async (status: string) =>
      (
        (
          await request(app())
            .get(`${sitesOf(owner)}?status=${status}`)
            .set(as(owner))
        ).body.data as { name: string }[]
      )
        .map((item) => item.name)
        .sort();
    expect(await names("all")).toEqual(["Draf", "Terbit"]);
    expect(await names("published")).toEqual(["Terbit"]);
    expect(await names("draft")).toEqual(["Draf"]);
    expect(await names("archived")).toEqual(["Arsip"]);
    expect(
      (
        await request(app())
          .get(`${sitesOf(owner)}?status=hapus`)
          .set(as(owner))
      ).status,
    ).toBe(422);
  });

  it("urutan nama (tanpa beda huruf besar/kecil), dibuat, & terakhir diedit — lintas halaman", async () => {
    const { owner, ids } = await workspaceWith(["beta", "Alfa", "delta", "Charlie", "echo"]);
    expect(await allPages(owner, "sort=name")).toEqual(["Alfa", "beta", "Charlie", "delta", "echo"]);
    expect(await allPages(owner, "sort=created")).toEqual(["echo", "Charlie", "delta", "Alfa", "beta"]);
    // Situs tertua diedit → paling atas di "terakhir diedit".
    await request(app()).patch(siteUrl(ids[0])).set(as(owner)).send({ name: "beta baru" });
    const updated = await allPages(owner, "sort=updated");
    expect(updated[0]).toBe("beta baru");
    expect(updated).toHaveLength(5);
  });

  it("terakhir diedit: waktu identik & beda mikrodetik tetap terurut tanpa ganda/terlewat", async () => {
    const { owner, ids } = await workspaceWith(["s1", "s2", "s3", "s4", "s5", "s6"]);
    // s1–s3 identik; s4–s6 hanya beda mikrodetik (presisi yang hilang bila memakai Date JS).
    await testDb.db
      .update(schema.sites)
      .set({ updatedAt: sql`'2026-10-14 10:00:00.000500+00'::timestamptz` })
      .where(inArray(schema.sites.id, ids.slice(0, 3)));
    for (const [index, id] of ids.slice(3).entries()) {
      await testDb.db
        .update(schema.sites)
        .set({ updatedAt: sql`${`2026-10-14 11:00:00.00010${index + 1}+00`}::timestamptz` })
        .where(eq(schema.sites.id, id));
    }
    const names = await allPages(owner, "sort=updated", 2);
    expect(names.slice(0, 3)).toEqual(["s6", "s5", "s4"]);
    expect([...names.slice(3)].sort()).toEqual(["s1", "s2", "s3"]);
  });

  it("cari nama (tanpa beda huruf; % dan _ diperlakukan harfiah)", async () => {
    const { owner } = await workspaceWith(["Toko Kue Bu Sri", "KUE BASAH", "Bengkel", "Diskon 50%", "Diskon 500"]);
    const search = async (q: string) =>
      (
        (
          await request(app())
            .get(`${sitesOf(owner)}?q=${encodeURIComponent(q)}`)
            .set(as(owner))
        ).body.data as {
          name: string;
        }[]
      )
        .map((item) => item.name)
        .sort();
    expect(await search("kue")).toEqual(["KUE BASAH", "Toko Kue Bu Sri"]);
    expect(await search("50%")).toEqual(["Diskon 50%"]);
    expect(await search("_")).toEqual([]);
  });

  it("cursor dari urutan lain → 422; halaman default 24 situs", async () => {
    const { owner } = await workspaceWith(Array.from({ length: 25 }, (_, index) => `Situs ${index}`));
    const byName = (
      await request(app())
        .get(`${sitesOf(owner)}?sort=name&limit=2`)
        .set(as(owner))
    ).body;
    const mixed = await request(app())
      .get(`${sitesOf(owner)}?sort=updated&cursor=${byName.meta.nextCursor}`)
      .set(as(owner));
    expect(mixed.status).toBe(422);

    const first = (await request(app()).get(sitesOf(owner)).set(as(owner))).body;
    expect(first.data).toHaveLength(24);
    expect(first.meta.nextCursor).toEqual(expect.any(String));
  });
});

describe("buat situs kosong (T1.6.2, ACC-051)", () => {
  it("dokumen awal: snapshot seq 0 (state Yjs + JSON strict, 1 page Home) + read model site_pages", async () => {
    const owner = await register();
    const created = await request(app()).post(sitesOf(owner)).set(as(owner)).send({ name: "Toko Kue Bu Sri" });
    expect(created.status).toBe(201);
    const site = created.body.data as { id: string; documentId: string };

    const [document] = await testDb.db.select().from(schema.documents).where(eq(schema.documents.id, site.documentId));
    expect(document).toMatchObject({
      siteId: site.id,
      kind: "site",
      schemaVersion: CURRENT_SCHEMA_VERSION,
      lastSeq: 0,
    });
    expect(document?.sizeBytes).toBeGreaterThan(0);

    const [snapshot] = await testDb.db
      .select()
      .from(schema.documentSnapshots)
      .where(eq(schema.documentSnapshots.documentId, site.documentId));
    expect(snapshot).toMatchObject({
      id: document?.lastSnapshotId,
      uptoSeq: 0,
      kind: "auto",
      createdBy: owner.user.id,
    });
    const json = SiteDocumentSchema.parse(snapshot?.json);
    expect(json.meta).toEqual({ title: "Toko Kue Bu Sri", createdWith: "blank" });
    expect(json.pageOrder).toHaveLength(1);
    // State biner = JSON (realtime memuat dari state; publish/history dari JSON).
    expect(siteDocumentFromState(snapshot?.state ?? new Uint8Array())).toEqual(json);

    const pages = await testDb.db.select().from(schema.sitePages).where(eq(schema.sitePages.siteId, site.id));
    expect(pages).toEqual([
      expect.objectContaining({
        pageId: json.pageOrder[0],
        path: "/",
        title: "Home",
        isHome: true,
        nodeCount: 1,
        sortOrder: 0,
      }),
    ]);
  });
});

describe("rute level situs /v1/sites/:siteId (T1.6.3)", () => {
  it("tanpa sesi → 401", async () => {
    const site = (await request(app()).post(sitesOf(alice)).set(as(alice)).send({ name: "Publik?" })).body.data;
    expect((await request(app()).get(siteUrl(site.id))).status).toBe(401);
  });

  it("viewer: lihat boleh, ganti nama & hapus 403", async () => {
    const { member, team, owner } = await teamMember("viewer");
    const site = (await request(app()).post(sitesOf(team)).set(as(owner)).send({ name: "Situs Tim" })).body.data;
    expect((await request(app()).get(siteUrl(site.id)).set(as(member))).body.data.name).toBe("Situs Tim");
    expect((await request(app()).patch(siteUrl(site.id)).set(as(member)).send({ name: "x" })).status).toBe(403);
    expect((await request(app()).delete(siteUrl(site.id)).set(as(member))).status).toBe(403);
  });

  it("situs dihapus → semua operasi 404; jalur lama bersarang di workspace tidak ada", async () => {
    const site = (await request(app()).post(sitesOf(alice)).set(as(alice)).send({ name: "Dihapus" })).body.data;
    expect((await request(app()).delete(siteUrl(site.id)).set(as(alice))).status).toBe(204);
    expect((await request(app()).get(siteUrl(site.id)).set(as(alice))).status).toBe(404);
    expect((await request(app()).patch(siteUrl(site.id)).set(as(alice)).send({ name: "Hidup lagi" })).status).toBe(404);
    expect((await request(app()).delete(siteUrl(site.id)).set(as(alice))).status).toBe(404);

    const live = (await request(app()).post(sitesOf(alice)).set(as(alice)).send({ name: "Masih ada" })).body.data;
    expect(
      (
        await request(app())
          .get(`${sitesOf(alice)}/${live.id}`)
          .set(as(alice))
      ).status,
    ).toBe(404);
  });
});
