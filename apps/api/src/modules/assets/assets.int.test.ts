import { and, eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import type { Express } from "express";
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
import type { AssetStorage } from "../../lib/storage";

// Modul assets (T2.12.1) lewat jalur produksi: sesi → tenantResolver (site→workspace→keanggotaan) → presign + record
// pending, complete → job image-processing. Storage di-fake (presign deterministik tanpa MinIO). Postgres & Redis asli.

interface TestUser {
  cookie: string;
  user: { id: string };
  workspace: { id: string };
}

let testDb: TestDb;
let redis: Redis;
let target: Express;
let queues: ReturnType<typeof recordingQueues>;
let alice: TestUser;
let bob: TestUser;
let aliceSiteId: string;
let ipCounter = 0;

const fakeStorage: AssetStorage = {
  uploadsBucket: "uploads",
  assetsBucket: "assets",
  presignUpload: async ({ key, contentType }) =>
    `http://minio.test/uploads/${key}?ct=${encodeURIComponent(contentType)}`,
};

async function register(): Promise<TestUser> {
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
  if (!user || !workspace) throw new Error("registrasi test gagal");
  return { cookie: sessionCookie(response.headers["set-cookie"]) ?? "", user, workspace };
}

const as = (who: TestUser) => ({ cookie: who.cookie, origin: TEST_ORIGIN });
const assetsUrl = (siteId: string) => `/v1/sites/${siteId}/assets`;

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  queues = recordingQueues();
  target = authTestApp(testDb, redis, queues, { storage: fakeStorage });
  alice = await register();
  bob = await register();
  const site = await request(target).post(`/v1/workspaces/${alice.workspace.id}/sites`).set(as(alice)).send({
    name: "Toko Alice",
  });
  aliceSiteId = site.body.data.id;
});
afterAll(async () => {
  redis.disconnect();
  await testDb.drop();
});

describe("assets upload (T2.12.1, ED-160)", () => {
  it("presign membuat record pending ber-scope tenant + URL upload", async () => {
    const res = await request(target)
      .post(assetsUrl(aliceSiteId))
      .set(as(alice))
      .send({ mime: "image/png", sizeBytes: 2048, fileName: "logo.png" });
    expect(res.status).toBe(201);
    expect(res.body.data.assetId).toMatch(/^ast_[0-9a-z]{6,24}$/);
    expect(res.body.data.storageKey).toBe(`uploads/${alice.workspace.id}/${res.body.data.assetId}`);
    expect(res.body.data.uploadUrl).toContain(res.body.data.storageKey);
    expect(res.body.data.headers["Content-Type"]).toBe("image/png");

    const [row] = await testDb.db.select().from(schema.assets).where(eq(schema.assets.id, res.body.data.assetId));
    expect(row).toMatchObject({
      workspaceId: alice.workspace.id,
      kind: "image",
      mime: "image/png",
      sizeBytes: 2048,
      status: "pending",
      uploadedBy: alice.user.id,
    });
  });

  it("SVG → kind svg", async () => {
    const res = await request(target)
      .post(assetsUrl(aliceSiteId))
      .set(as(alice))
      .send({ mime: "image/svg+xml", sizeBytes: 500 });
    expect(res.status).toBe(201);
    const [row] = await testDb.db.select().from(schema.assets).where(eq(schema.assets.id, res.body.data.assetId));
    expect(row?.kind).toBe("svg");
  });

  it("complete mengantre job image-processing & mengembalikan status", async () => {
    const presign = await request(target)
      .post(assetsUrl(aliceSiteId))
      .set(as(alice))
      .send({ mime: "image/webp", sizeBytes: 1000 });
    const assetId = presign.body.data.assetId;
    const res = await request(target)
      .post(`${assetsUrl(aliceSiteId)}/${assetId}/complete`)
      .set(as(alice))
      .send();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: assetId, status: "pending" });
    expect(
      queues.jobs.some(
        (job) => job.queue === "image-processing" && (job.payload as { assetId?: string }).assetId === assetId,
      ),
    ).toBe(true);
  });

  it("mime tidak diizinkan / ukuran berlebih → 422", async () => {
    const bad = await request(target)
      .post(assetsUrl(aliceSiteId))
      .set(as(alice))
      .send({ mime: "application/zip", sizeBytes: 10 });
    expect(bad.status).toBe(422);
    const tooBig = await request(target)
      .post(assetsUrl(aliceSiteId))
      .set(as(alice))
      .send({ mime: "image/png", sizeBytes: 11 * 1024 * 1024 });
    expect(tooBig.status).toBe(422);
  });

  it("isolasi tenant: user lain tidak bisa presign/lihat aset situs ini (404)", async () => {
    const presign = await request(target)
      .post(assetsUrl(aliceSiteId))
      .set(as(alice))
      .send({ mime: "image/png", sizeBytes: 123 });
    const assetId = presign.body.data.assetId;

    expect(
      (await request(target).post(assetsUrl(aliceSiteId)).set(as(bob)).send({ mime: "image/png", sizeBytes: 1 }))
        .status,
    ).toBe(404);
    expect(
      (
        await request(target)
          .get(`${assetsUrl(aliceSiteId)}/${assetId}`)
          .set(as(bob))
      ).status,
    ).toBe(404);
    // Pastikan aset Alice tidak terhapus/terbaca oleh Bob.
    const [row] = await testDb.db
      .select()
      .from(schema.assets)
      .where(and(eq(schema.assets.id, assetId), eq(schema.assets.workspaceId, alice.workspace.id)));
    expect(row).toBeTruthy();
  });

  it("complete aset tidak ada → 404", async () => {
    const res = await request(target)
      .post(`${assetsUrl(aliceSiteId)}/ast_000000notexist/complete`)
      .set(as(alice))
      .send();
    expect(res.status).toBe(404);
  });
});
