import { eq, schema } from "@platform/db";
import { createSite, createTestDb, createUser, type TestDb } from "@platform/db/testing";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkerEnv } from "../../config/env";
import { createImageStorage, type ImageStorage } from "../../lib/storage";
import { createImageProcessingProcessor } from "./image-processing.processor";

// T2.12.2: processor image-processing dari ujung ke ujung dengan MinIO & Postgres asli — JPEG mentah di `uploads` →
// varian WebP/AVIF di `assets` + status ready (dimensi/blurhash/sha256). Jalankan lewat `pnpm test:integration`.

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => silentLogger,
} as never;

const context = { jobId: "job-test", attempt: 1, signal: new AbortController().signal, logger: silentLogger };

let testDb: TestDb;
let storage: ImageStorage;

// createImageStorage hanya membaca field S3_* dari env.
const storageEnv = {
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  S3_REGION: process.env.S3_REGION ?? "auto",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  S3_BUCKET_UPLOADS: process.env.S3_BUCKET_UPLOADS ?? "uploads",
  S3_BUCKET_ASSETS: process.env.S3_BUCKET_ASSETS ?? "assets",
  S3_FORCE_PATH_STYLE: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
} as WorkerEnv;

beforeAll(async () => {
  testDb = await createTestDb();
  storage = createImageStorage(storageEnv);
});
afterAll(async () => {
  await testDb.drop();
});

// ID aset format `ast_[0-9a-z]{6,24}` (cek constraint) tanpa dependency document-model di worker.
let astCounter = 0;
const nextAssetId = () => `ast_${Date.now().toString(36)}${(astCounter++).toString(36).padStart(2, "0")}`;

async function seedPendingAsset(sizeBytes: number, kind: "image" | "svg" = "image") {
  const { workspace } = await createUser(testDb.db);
  const { site } = await createSite(testDb.db, { workspace });
  const id = nextAssetId();
  const storageKey = `uploads/${workspace.id}/${id}`;
  await testDb.db.insert(schema.assets).values({
    id,
    workspaceId: workspace.id,
    siteId: site.id,
    kind,
    storageKey,
    mime: kind === "svg" ? "image/svg+xml" : "image/jpeg",
    sizeBytes,
    status: "pending",
  });
  return { id, workspaceId: workspace.id, storageKey };
}

describe("image-processing processor (T2.12.2, ED-160)", () => {
  it("JPEG → varian WebP/AVIF di assets + status ready dengan dimensi/blurhash", async () => {
    const jpeg = await sharp({ create: { width: 48, height: 32, channels: 3, background: "#ff5500" } })
      .jpeg()
      .toBuffer();
    const asset = await seedPendingAsset(jpeg.length);
    await storage.putObject({
      bucket: storage.uploadsBucket,
      key: asset.storageKey,
      body: jpeg,
      contentType: "image/jpeg",
    });

    await createImageProcessingProcessor({ db: testDb.db, storage })({ requestId: "r", assetId: asset.id }, context);

    const [row] = await testDb.db.select().from(schema.assets).where(eq(schema.assets.id, asset.id));
    expect(row).toMatchObject({ status: "ready", width: 48, height: 32 });
    expect(row?.blurhash).toBeTruthy();
    expect(row?.sha256).toHaveLength(64);
    const variants = row?.variants as { webp: string; avif: string };
    expect(variants.webp).toBe(`assets/${asset.workspaceId}/${asset.id}/full.webp`);

    // Varian benar-benar ada di MinIO & valid.
    const webp = await storage.getObject(storage.assetsBucket, variants.webp);
    expect((await sharp(webp).metadata()).format).toBe("webp");
    const avif = await storage.getObject(storage.assetsBucket, variants.avif);
    expect((await sharp(avif).metadata()).format).toBe("heif"); // avif = container heif

    // Pemakaian storage workspace bertambah.
    const [usage] = await testDb.db
      .select()
      .from(schema.storageUsage)
      .where(eq(schema.storageUsage.workspaceId, asset.workspaceId));
    expect(usage?.bytesUsed).toBe(jpeg.length);
  });

  it("file rusak → status rejected (bukan error job)", async () => {
    const asset = await seedPendingAsset(10);
    await storage.putObject({
      bucket: storage.uploadsBucket,
      key: asset.storageKey,
      body: Buffer.from("bukan gambar"),
      contentType: "image/jpeg",
    });
    await createImageProcessingProcessor({ db: testDb.db, storage })({ requestId: "r", assetId: asset.id }, context);
    const [row] = await testDb.db.select().from(schema.assets).where(eq(schema.assets.id, asset.id));
    expect(row?.status).toBe("rejected");
  });

  it("SVG ditolak sementara (sanitasi belum ada)", async () => {
    const asset = await seedPendingAsset(50, "svg");
    await createImageProcessingProcessor({ db: testDb.db, storage })({ requestId: "r", assetId: asset.id }, context);
    const [row] = await testDb.db.select().from(schema.assets).where(eq(schema.assets.id, asset.id));
    expect(row?.status).toBe("rejected");
  });
});
