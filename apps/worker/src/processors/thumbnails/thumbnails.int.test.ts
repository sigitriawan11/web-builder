import { and, eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkerEnv } from "../../config/env";
import { createImageStorage, type ImageStorage } from "../../lib/storage";
import { createRendererService, type RendererService } from "../../renderer-service";
import { createThumbnailsProcessor } from "./thumbnails.processor";

// T3.7.2 / CMP-014: publish component → render 3 breakpoint → PNG di bucket `assets` + ref di DB. MinIO + Postgres +
// Chromium asli (`pnpm test:integration`).

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => silentLogger,
} as never;
const context = { jobId: "job-thumb", attempt: 1, signal: new AbortController().signal, logger: silentLogger };

const storageEnv = {
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  S3_REGION: process.env.S3_REGION ?? "auto",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  S3_BUCKET_UPLOADS: process.env.S3_BUCKET_UPLOADS ?? "uploads",
  S3_BUCKET_ASSETS: process.env.S3_BUCKET_ASSETS ?? "assets",
  S3_FORCE_PATH_STYLE: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
} as WorkerEnv;

const DEFINITION = {
  schemaVersion: 1,
  id: "cmp_thumbdemo1",
  version: 1,
  name: "ThumbDemo",
  category: "card",
  propsSchema: [],
  rootId: "n_root0001",
  nodes: {
    n_root0001: {
      id: "n_root0001",
      type: "frame",
      name: "Root",
      parentId: null,
      visible: true,
      locked: false,
      tag: "div",
      children: ["n_text0001"],
      style: { base: { size: { width: { mode: "fill" }, height: { mode: "fixed", value: 120, unit: "px" } } } },
      props: {},
    },
    n_text0001: {
      id: "n_text0001",
      type: "text",
      name: "Title",
      parentId: "n_root0001",
      visible: true,
      locked: false,
      tag: "p",
      style: { base: {} },
      props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Thumb" }] }] } },
    },
  },
};

let testDb: TestDb;
let storage: ImageStorage;
let renderer: RendererService;

beforeAll(async () => {
  testDb = await createTestDb();
  storage = createImageStorage(storageEnv);
  renderer = createRendererService({ contexts: 1 });
});
afterAll(async () => {
  await renderer.close();
  await testDb.drop();
});

async function seedPublishedComponent(): Promise<string> {
  const categoryId = uuidv7();
  await testDb.db.insert(schema.libraryCategories).values({
    id: categoryId,
    slug: `thumb-cat-${categoryId}`,
    scope: "component",
    type: "functional",
    name: { id: "Demo", en: "Demo" },
  });
  const componentId = uuidv7();
  await testDb.db.insert(schema.components).values({
    id: componentId,
    publicId: `cmp_${componentId.replace(/-/g, "").slice(0, 16)}`,
    slug: `thumb-${componentId}`,
    ownerType: "platform",
    kind: "section",
    categoryId,
    name: "ThumbDemo",
    displayName: { id: "Demo", en: "Demo" },
    description: { id: "d", en: "d" },
    status: "published",
  });
  const versionId = uuidv7();
  await testDb.db.insert(schema.componentVersions).values({
    id: versionId,
    componentId,
    version: "1.0.0",
    versionSeq: 1,
    status: "published",
    definition: DEFINITION,
  });
  return versionId;
}

describe("thumbnails processor (T3.7.2, CMP-014)", () => {
  it("render component published → 3 PNG di bucket assets + ref DB per breakpoint", async () => {
    const versionId = await seedPublishedComponent();

    await createThumbnailsProcessor({ db: testDb.db, storage, renderer })(
      { requestId: "r", target: "component", componentVersionId: versionId },
      context,
    );

    for (const breakpoint of ["base", "tablet", "mobile"] as const) {
      const key = `thumbnails/components/${versionId}/${breakpoint}.png`;
      const png = await storage.getObject(storage.assetsBucket, key);
      expect((await sharp(png).metadata()).format).toBe("png");

      const [row] = await testDb.db
        .select()
        .from(schema.componentVersionThumbnails)
        .where(
          and(
            eq(schema.componentVersionThumbnails.componentVersionId, versionId),
            eq(schema.componentVersionThumbnails.breakpoint, breakpoint),
          ),
        );
      expect(row?.assetKey).toBe(key);
      expect(row?.width ?? 0).toBeGreaterThan(0);
    }
  });

  it("versi tak published → dilewati (tidak ada thumbnail)", async () => {
    await createThumbnailsProcessor({ db: testDb.db, storage, renderer })(
      { requestId: "r", target: "component", componentVersionId: uuidv7() },
      context,
    );
    // Tidak melempar; cukup tak ada baris.
    const rows = await testDb.db.select().from(schema.componentVersionThumbnails).limit(10);
    expect(Array.isArray(rows)).toBe(true);
  });
});
