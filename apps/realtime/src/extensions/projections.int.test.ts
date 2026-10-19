import type { Server } from "@hocuspocus/server";
import { asc, eq, schema, systemScope } from "@platform/db";
import { createSite, createTestDb, createUser, createWorkspace, type TestDb } from "@platform/db/testing";
import {
  createBlankSiteDocument,
  createInstance,
  createPage,
  deletePage,
  jsonToYDoc,
  runCommand,
  updatePage,
  userOrigin,
} from "@platform/document-model";
import { uuidv7 } from "@platform/shared";
import { createLogger } from "@platform/shared/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { connectClient, sleep, type TestClient, waitFor } from "../../test/realtime-client";
import type { RealtimeContext } from "../auth";
import { appendDocumentUpdates } from "../persistence/documents.repository";
import { createRealtimeServer } from "../server";
import { PersistenceExtension } from "./persistence";
import { ProjectionsExtension } from "./projections";

// T1.12.7: extension projections → read model `site_pages` (ARCHITECTURE §5.5).
const SECRET = "test-realtime-secret-0123456789abcdef";
const logger = createLogger({ service: "realtime-test", env: "test", level: "silent" });

let testDb: TestDb;
let server: Server<RealtimeContext>;
let url: string;
const clients: TestClient[] = [];

beforeAll(async () => {
  testDb = await createTestDb();
  server = createRealtimeServer({
    port: 0,
    host: "127.0.0.1",
    tokenSecret: SECRET,
    logger,
    storeDebounceMs: 50,
    storeMaxDebounceMs: 200,
    extensions: [
      new PersistenceExtension({ db: testDb.db, logger, flushDebounceMs: 50, flushMaxWaitMs: 200 }),
      new ProjectionsExtension({ db: testDb.db, logger }),
    ],
  });
  await server.listen();
  url = `ws://127.0.0.1:${server.address.port}`;
});
afterEach(() => {
  for (const client of clients.splice(0)) client.provider.destroy();
});
afterAll(async () => {
  await server.destroy();
  await testDb.drop();
});

async function openSite() {
  const { user: owner } = await createUser(testDb.db);
  const { site, document } = await createSite(testDb.db, {
    workspace: await createWorkspace(testDb.db, { owner }),
  });
  const state = Y.encodeStateAsUpdate(jsonToYDoc(createBlankSiteDocument({ title: "Toko" })));
  await appendDocumentUpdates(testDb.db, systemScope("test projections"), document.id, [
    { update: state, origin: "local" },
  ]);
  const client = await connectClient({ url, secret: SECRET, userId: owner.id, docId: document.id, siteId: site.id });
  clients.push(client);
  return { siteId: site.id, client, ctx: { doc: client.doc, origin: userOrigin("test") } };
}

async function pages(siteId: string) {
  return testDb.db
    .select({
      pageId: schema.sitePages.pageId,
      path: schema.sitePages.path,
      title: schema.sitePages.title,
      isHome: schema.sitePages.isHome,
      sortOrder: schema.sitePages.sortOrder,
      nodeCount: schema.sitePages.nodeCount,
      seo: schema.sitePages.seo,
    })
    .from(schema.sitePages)
    .where(eq(schema.sitePages.siteId, siteId))
    .orderBy(asc(schema.sitePages.sortOrder));
}

// CMP-051/CMP-156: seed component platform published agar instance (cmp_…@versionSeq) ter-resolve ke UUID + semver.
async function seedComponent(publicId: string, versionSeq: number, semver: string) {
  const categoryId = uuidv7();
  await testDb.db
    .insert(schema.libraryCategories)
    .values({
      id: categoryId,
      slug: `cat-${publicId}`,
      scope: "component",
      type: "functional",
      name: { id: "K", en: "C" },
    });
  const componentId = uuidv7();
  await testDb.db.insert(schema.components).values({
    id: componentId,
    publicId,
    slug: `slug-${publicId}`,
    ownerType: "platform",
    kind: "element",
    categoryId,
    name: publicId,
    displayName: { id: publicId, en: publicId },
    description: { id: "d", en: "d" },
    status: "published",
    latestVersion: semver,
  });
  await testDb.db.insert(schema.componentVersions).values({
    componentId,
    version: semver,
    versionSeq,
    status: "published",
    definition: { rootId: "n_x", nodes: {} },
  });
  return componentId;
}

async function usage(siteId: string) {
  return testDb.db
    .select({
      componentId: schema.siteComponentUsage.componentId,
      version: schema.siteComponentUsage.version,
      docState: schema.siteComponentUsage.docState,
      instanceCount: schema.siteComponentUsage.instanceCount,
      pageIds: schema.siteComponentUsage.pageIds,
      hasOverrides: schema.siteComponentUsage.hasOverrides,
    })
    .from(schema.siteComponentUsage)
    .where(eq(schema.siteComponentUsage.siteId, siteId));
}

describe("projections → site_component_usage (CMP-051)", () => {
  it("sisip instance → usage tercatat (UUID + semver, docState draft, pageIds); referensi tak dikenal dilewati", async () => {
    const componentId = await seedComponent("cmp_widget0001", 1, "1.0.0");
    const { siteId, client, ctx } = await openSite();
    const home = client.doc.getArray<string>("pageOrder").get(0);

    runCommand(ctx, createInstance, { parentId: home, componentId: "cmp_widget0001", version: 1 });
    await waitFor(async () => (await usage(siteId)).length === 1);
    expect(await usage(siteId)).toEqual([
      {
        componentId,
        version: "1.0.0",
        docState: "draft",
        instanceCount: 1,
        pageIds: [home],
        hasOverrides: false,
      },
    ]);

    // Instance kedua component sama → count naik; instance component tak dikenal → dilewati (usage tetap 1 baris).
    runCommand(ctx, createInstance, { parentId: home, componentId: "cmp_widget0001", version: 1 });
    runCommand(ctx, createInstance, { parentId: home, componentId: "cmp_takkenal01", version: 1 });
    await waitFor(async () => (await usage(siteId))[0]?.instanceCount === 2);
    expect(await usage(siteId)).toHaveLength(1);
  });
});

describe("projections → site_pages", () => {
  it("rename page (judul, path, SEO) → read model ter-update (AC T1.12.7)", async () => {
    const { siteId, client, ctx } = await openSite();
    const home = client.doc.getArray<string>("pageOrder").get(0);
    const created = runCommand(ctx, createPage, { title: "Produk", path: "/produk" });
    if (!created.ok) throw new Error(created.error.code);
    await waitFor(async () => (await pages(siteId)).length === 2);

    runCommand(ctx, updatePage, {
      id: created.value,
      patch: { title: "Katalog", path: "/katalog", seo: { description: "Semua produk" } },
    });
    await waitFor(async () => (await pages(siteId))[1]?.title === "Katalog");
    expect(await pages(siteId)).toEqual([
      { pageId: home, path: "/", title: "Beranda", isHome: true, sortOrder: 0, nodeCount: 1, seo: null },
      {
        pageId: created.value,
        path: "/katalog",
        title: "Katalog",
        isHome: false,
        sortOrder: 1,
        nodeCount: 1,
        seo: { description: "Semua produk" },
      },
    ]);
  });

  it("tukar home (path bertukar) & hapus page → tidak melanggar unique index; baris page terhapus hilang", async () => {
    const { siteId, client, ctx } = await openSite();
    const home = client.doc.getArray<string>("pageOrder").get(0);
    const about = runCommand(ctx, createPage, { title: "Tentang", path: "/tentang" });
    if (!about.ok) throw new Error(about.error.code);
    runCommand(ctx, updatePage, { id: about.value, patch: { isHome: true } });
    await waitFor(async () => (await pages(siteId)).some((page) => page.pageId === about.value && page.isHome));
    expect((await pages(siteId)).map(({ pageId, path }) => ({ pageId, path }))).toEqual([
      { pageId: home, path: "/tentang" },
      { pageId: about.value, path: "/" },
    ]);

    expect(runCommand(ctx, deletePage, { id: home }).ok).toBe(true);
    await waitFor(async () => (await pages(siteId)).length === 1);
    expect((await pages(siteId))[0]).toMatchObject({ pageId: about.value, sortOrder: 0 });
  });

  it("dokumen tidak valid → read model terakhir dipertahankan", async () => {
    const { siteId, client, ctx } = await openSite();
    const home = client.doc.getArray<string>("pageOrder").get(0);
    runCommand(ctx, updatePage, { id: home, patch: { title: "Halaman Utama" } });
    await waitFor(async () => (await pages(siteId))[0]?.title === "Halaman Utama");

    // Sengaja merusak lewat Y.Map mentah (bukan command): path page tidak valid lalu judul berubah.
    client.doc.transact(() => {
      const props = (client.doc.getMap("nodes").get(home) as Y.Map<unknown>).get("props") as Y.Map<unknown>;
      props.set("path", "BUKAN PATH");
      props.set("title", "Rusak");
    });
    await sleep(500);
    expect((await pages(siteId))[0]).toMatchObject({ path: "/", title: "Halaman Utama" });
  });
});
