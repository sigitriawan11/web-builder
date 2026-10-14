import { eq, inArray, schema, sql } from "@platform/db";
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
    await request(app())
      .patch(`${sitesOf(owner)}/${ids[0]}`)
      .set(as(owner))
      .send({ name: "beta baru" });
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
