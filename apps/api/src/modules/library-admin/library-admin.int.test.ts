import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import { REALTIME_TOKEN_AUDIENCE, RealtimeTokenClaimsSchema } from "@platform/shared/contracts";
import { verifyToken } from "@platform/shared/node";
import type { Express } from "express";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authTestApp,
  sessionCookie,
  signUpBody,
  TEST_ORIGIN,
  TEST_REALTIME_SECRET,
  uniqueEmail,
} from "../../auth/auth.test-harness";
import type { StaffRole } from "../../middleware/staff";

// T3.3.7 (CMP-159): CRUD admin library. Fokus AC: role non-staf → 404 (permukaan tak bocor); publish transaksional
// (draft → versi published + pointer latest_*); setiap mutasi menulis audit_logs.
let testDb: TestDb;
let redis: Redis;
let target: Express;
let ipCounter = 0;
let categoryId: string;

const label = { id: "L", en: "L" };
const definition = () => ({
  schemaVersion: 1,
  id: "cmp_admintest01",
  version: 1,
  name: "Admin Test",
  category: "button" as const,
  propsSchema: [{ key: "label", label, type: "text", default: "Klik" }],
  rootId: "n_root0001",
  nodes: {
    n_root0001: {
      id: "n_root0001",
      type: "text",
      name: "Label",
      parentId: null,
      visible: true,
      locked: false,
      tag: "span",
      style: { base: {} },
      props: { content: { $prop: "label" } },
    },
  },
});

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  target = authTestApp(testDb, redis);
  categoryId = uuidv7();
  await testDb.db.insert(schema.libraryCategories).values({
    id: categoryId,
    slug: "admin-test-cat",
    scope: "component",
    type: "functional",
    name: { id: "Uji", en: "Test" },
  });
});
afterAll(async () => {
  redis.disconnect();
  await testDb.drop();
});

async function register(staffRole?: StaffRole) {
  const email = uniqueEmail();
  const response = await request(target)
    .post("/auth/sign-up/email")
    .set("origin", TEST_ORIGIN)
    .set("x-forwarded-for", `198.18.11.${(ipCounter++ % 250) + 1}`)
    .send(signUpBody(email));
  if (staffRole) {
    await testDb.db.update(schema.users).set({ staffRole }).where(eq(schema.users.email, email));
  }
  return sessionCookie(response.headers["set-cookie"]) ?? "";
}

const createBody = (slug: string) => ({
  slug,
  categoryId,
  kind: "element" as const,
  name: "Admin Test",
  displayName: { id: "Uji Admin", en: "Admin Test" },
  description: { id: "Dipakai test", en: "Used in test" },
  definition: definition(),
});

describe("admin library CRUD (CMP-159)", () => {
  it("user biasa (bukan staf) → 404 di semua endpoint; tanpa sesi → 401", async () => {
    const plain = await register();
    const id = uuidv7();
    expect(
      (await request(target).post("/v1/admin/library/components").set("cookie", plain).send(createBody("x1"))).status,
    ).toBe(404);
    expect(
      (await request(target).put(`/v1/admin/library/components/${id}/draft`).set("cookie", plain).send({})).status,
    ).toBe(404);
    expect(
      (
        await request(target)
          .post(`/v1/admin/library/components/${id}/draft/publish`)
          .set("cookie", plain)
          .send({ bump: "minor", changelog: label })
      ).status,
    ).toBe(404);
    expect((await request(target).get(`/v1/admin/library/components/${id}/usage`).set("cookie", plain)).status).toBe(
      404,
    );
    // Tanpa sesi → 401 (requireAuth sebelum requireStaffRole).
    expect((await request(target).post("/v1/admin/library/components").send(createBody("x2"))).status).toBe(401);
  });

  it("staf library_admin: create → publish → baca via editor API; audit tercatat", async () => {
    const admin = await register("library_admin");
    const created = await request(target)
      .post("/v1/admin/library/components")
      .set("cookie", admin)
      .send(createBody("tombol-admin"));
    expect(created.status).toBe(201);
    const { id, publicId } = created.body.data as { id: string; publicId: string };
    expect(publicId).toMatch(/^cmp_[0-9a-z]{6,24}$/);

    const published = await request(target)
      .post(`/v1/admin/library/components/${id}/draft/publish`)
      .set("cookie", admin)
      .send({ bump: "minor", changelog: { id: "Rilis awal", en: "Initial" } });
    expect(published.status).toBe(200);
    expect(published.body.data).toEqual({ version: "0.1.0", versionSeq: 1 });

    // Editor read API (T3.3.8) kini menemukan versi published.
    const read = await request(target).get(`/v1/library/components/${publicId}/versions/1`).set("cookie", admin);
    expect(read.status).toBe(200);
    expect(read.body.data.definition).toMatchObject({ rootId: "n_root0001" });

    // Komponen jadi published; audit create + publish tertulis.
    const [row] = await testDb.db.select().from(schema.components).where(eq(schema.components.id, id));
    expect(row?.status).toBe("published");
    expect(row?.latestVersion).toBe("0.1.0");
    expect(row?.draftVersionId).toBeNull();
    const audits = await testDb.db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, id));
    expect(audits.map((a) => a.action).sort()).toEqual(["library_component.create", "library_component.publish"]);
  });

  it("create → dokumen Yjs kind=component (workspace null) + draft_document_id; publish baca Yjs; definisi invalid → 422", async () => {
    const admin = await register("library_admin");
    const created = await request(target)
      .post("/v1/admin/library/components")
      .set("cookie", admin)
      .send(createBody("tombol-yjs"));
    const { id } = created.body.data as { id: string };

    // Draft = dokumen Yjs kind=component, global (workspace null), dengan snapshot awal.
    const [row] = await testDb.db.select().from(schema.components).where(eq(schema.components.id, id));
    expect(row?.draftDocumentId).not.toBeNull();
    const [doc] = await testDb.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, row?.draftDocumentId ?? ""));
    expect(doc?.kind).toBe("component");
    expect(doc?.workspaceId).toBeNull();
    expect(doc?.lastSnapshotId).not.toBeNull();

    // Publish membaca state Yjs draft → component_versions.
    const published = await request(target)
      .post(`/v1/admin/library/components/${id}/draft/publish`)
      .set("cookie", admin)
      .send({ bump: "patch", changelog: label });
    expect(published.status).toBe(200);
    expect(published.body.data).toEqual({ version: "0.0.1", versionSeq: 1 });
    // Draft tetap → publish lagi = versi baru (bukan 409).
    const again = await request(target)
      .post(`/v1/admin/library/components/${id}/draft/publish`)
      .set("cookie", admin)
      .send({ bump: "minor", changelog: label });
    expect(again.body.data).toEqual({ version: "0.1.0", versionSeq: 2 });

    const bad = await request(target)
      .post("/v1/admin/library/components")
      .set("cookie", admin)
      .send({ ...createBody("tombol-bad"), definition: { rootId: "n_tidakada", nodes: {} } });
    expect(bad.status).toBe(422);
  });

  it("deprecate & archive mengubah status; usage kosong → []", async () => {
    const admin = await register("library_admin");
    const created = await request(target)
      .post("/v1/admin/library/components")
      .set("cookie", admin)
      .send(createBody("tombol-lifecycle"));
    const { id } = created.body.data as { id: string };

    expect(
      (await request(target).get(`/v1/admin/library/components/${id}/usage`).set("cookie", admin)).body.data,
    ).toEqual([]);

    expect(
      (await request(target).post(`/v1/admin/library/components/${id}/deprecate`).set("cookie", admin).send({})).status,
    ).toBe(204);
    const [deprecated] = await testDb.db.select().from(schema.components).where(eq(schema.components.id, id));
    expect(deprecated?.status).toBe("deprecated");
    expect(deprecated?.deprecatedAt).not.toBeNull();

    expect(
      (await request(target).post(`/v1/admin/library/components/${id}/archive`).set("cookie", admin).send({})).status,
    ).toBe(204);
    const [archived] = await testDb.db.select().from(schema.components).where(eq(schema.components.id, id));
    expect(archived?.status).toBe("archived");
  });

  it("matriks role CMP-010: designer boleh draft tapi publish → 403; staf read-only → draft 403", async () => {
    const admin = await register("library_admin");
    const designer = await register("designer");
    const staff = await register("staff");

    // designer: boleh create draft (201) & simpan draft, tapi publish → 403 (bukan non-staf, jadi 403 bukan 404).
    const made = await request(target)
      .post("/v1/admin/library/components")
      .set("cookie", designer)
      .send(createBody("tombol-designer"));
    expect(made.status).toBe(201);
    const { id } = made.body.data as { id: string };
    expect(
      (
        await request(target)
          .post(`/v1/admin/library/components/${id}/draft/publish`)
          .set("cookie", designer)
          .send({ bump: "patch", changelog: label })
      ).status,
    ).toBe(403);

    // staf (read-only): create draft → 403; tapi baca sesi editor → 200.
    expect(
      (await request(target).post("/v1/admin/library/components").set("cookie", staff).send(createBody("tombol-staff")))
        .status,
    ).toBe(403);
    const session = await request(target).get(`/v1/admin/library/components/${id}`).set("cookie", staff);
    expect(session.status).toBe(200);
    expect(session.body.data.capabilities).toEqual({ role: "staff", canEditDraft: false, canPublish: false });

    // library_admin: sesi editor → kapabilitas penuh; komponen punya draft (belum dipublish).
    const adminSession = await request(target).get(`/v1/admin/library/components/${id}`).set("cookie", admin);
    expect(adminSession.body.data.capabilities).toEqual({
      role: "library_admin",
      canEditDraft: true,
      canPublish: true,
    });
    expect(adminSession.body.data.component).toMatchObject({ id, kind: "element", status: "draft", hasDraft: true });
  });

  it("simpan metadata draft (CMP-013): field tersimpan & muncul di sesi editor; tag non-kebab → 422", async () => {
    const admin = await register("library_admin");
    const made = await request(target)
      .post("/v1/admin/library/components")
      .set("cookie", admin)
      .send(createBody("tombol-metadata"));
    const { id } = made.body.data as { id: string };

    // Kategori kedua untuk menguji perubahan categoryId.
    const otherCategoryId = uuidv7();
    await testDb.db.insert(schema.libraryCategories).values({
      id: otherCategoryId,
      slug: "admin-test-cat-2",
      scope: "component",
      type: "industry",
      name: { id: "Lain", en: "Other" },
    });

    const saved = await request(target)
      .put(`/v1/admin/library/components/${id}/draft`)
      .set("cookie", admin)
      .send({
        displayName: { id: "Tombol Ajakan", en: "Call To Action" },
        description: { id: "Tombol CTA utama", en: "Primary CTA button" },
        categoryId: otherCategoryId,
        tags: ["cta", "with-icon"],
        keywords: { id: ["ajakan"], en: ["call to action"] },
        industries: ["kuliner"],
        aiHints: "Pakai di hero; prop label & href penting.",
        requiresFeatures: ["commerce"],
      });
    expect(saved.status).toBe(204);

    // GET sesi editor → summary memuat metadata tersimpan.
    const session = await request(target).get(`/v1/admin/library/components/${id}`).set("cookie", admin);
    expect(session.body.data.component).toMatchObject({
      categoryId: otherCategoryId,
      tags: ["cta", "with-icon"],
      keywords: { id: ["ajakan"], en: ["call to action"] },
      industries: ["kuliner"],
      aiHints: "Pakai di hero; prop label & href penting.",
      requiresFeatures: ["commerce"],
      displayName: { id: "Tombol Ajakan", en: "Call To Action" },
    });

    // Tag non-kebab ditolak (CMP-013 format).
    const bad = await request(target)
      .put(`/v1/admin/library/components/${id}/draft`)
      .set("cookie", admin)
      .send({ tags: ["Not Kebab"] });
    expect(bad.status).toBe(422);
  });

  it("token realtime draft component (D3): staf → kind=component + role sesuai kapabilitas; non-staf → 404", async () => {
    const admin = await register("library_admin");
    const staff = await register("staff");
    const plain = await register();
    const made = await request(target)
      .post("/v1/admin/library/components")
      .set("cookie", admin)
      .send(createBody("tombol-token"));
    const { id } = made.body.data as { id: string };
    const [row] = await testDb.db.select().from(schema.components).where(eq(schema.components.id, id));
    const draftDocumentId = row?.draftDocumentId ?? "";

    // library_admin bisa edit → role editor.
    const adminTok = await request(target)
      .post(`/v1/admin/library/components/${id}/realtime-token`)
      .set("cookie", admin)
      .send({});
    expect(adminTok.status).toBe(200);
    expect(adminTok.headers["cache-control"]).toBe("no-store");
    const claims = await verifyToken(TEST_REALTIME_SECRET, adminTok.body.data.token, {
      audience: REALTIME_TOKEN_AUDIENCE,
      claims: RealtimeTokenClaimsSchema,
    });
    expect(claims.ok && claims.value).toMatchObject({
      docId: draftDocumentId,
      siteId: null,
      role: "editor",
      kind: "component",
    });

    // staff read-only → role viewer.
    const staffTok = await request(target)
      .post(`/v1/admin/library/components/${id}/realtime-token`)
      .set("cookie", staff)
      .send({});
    const staffClaims = await verifyToken(TEST_REALTIME_SECRET, staffTok.body.data.token, {
      audience: REALTIME_TOKEN_AUDIENCE,
      claims: RealtimeTokenClaimsSchema,
    });
    expect(staffClaims.ok && staffClaims.value.role).toBe("viewer");

    // non-staf → 404.
    expect(
      (await request(target).post(`/v1/admin/library/components/${id}/realtime-token`).set("cookie", plain).send({}))
        .status,
    ).toBe(404);
  });

  it("definisi draft by public_id (CMP-011): staf → definisi; non-staf → 404", async () => {
    const admin = await register("library_admin");
    const plain = await register();
    const made = await request(target)
      .post("/v1/admin/library/components")
      .set("cookie", admin)
      .send(createBody("tombol-draftdef"));
    const { publicId } = made.body.data as { publicId: string };

    const got = await request(target).get(`/v1/admin/library/component-drafts/${publicId}`).set("cookie", admin);
    expect(got.status).toBe(200);
    expect(got.headers["cache-control"]).toBe("no-store");
    expect(got.body.data.componentId).toBe(publicId);
    // Definisi dibaca dari Y.Doc draft (round-trip codec) → rootId sesuai yang dibuat.
    expect(got.body.data.definition).toMatchObject({ rootId: "n_root0001" });

    expect(
      (await request(target).get(`/v1/admin/library/component-drafts/${publicId}`).set("cookie", plain)).status,
    ).toBe(404);
    // public_id tidak ada → 404; format bukan cmp_ → 422.
    expect(
      (await request(target).get("/v1/admin/library/component-drafts/cmp_tidakada").set("cookie", admin)).status,
    ).toBe(404);
    expect((await request(target).get("/v1/admin/library/component-drafts/bukan-id").set("cookie", admin)).status).toBe(
      422,
    );
  });

  it("sesi editor untuk user biasa (bukan staf) → 404", async () => {
    const admin = await register("library_admin");
    const plain = await register();
    const made = await request(target)
      .post("/v1/admin/library/components")
      .set("cookie", admin)
      .send(createBody("tombol-sesi"));
    const { id } = made.body.data as { id: string };
    expect((await request(target).get(`/v1/admin/library/components/${id}`).set("cookie", plain)).status).toBe(404);
  });
});
