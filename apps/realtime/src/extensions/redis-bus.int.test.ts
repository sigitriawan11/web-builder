import type { Document, Server } from "@hocuspocus/server";
import { eq, schema, systemScope } from "@platform/db";
import { createSite, createTestDb, createUser, createWorkspace, type TestDb } from "@platform/db/testing";
import {
  createBlankSiteDocument,
  createPage,
  jsonToYDoc,
  loadDocument,
  runCommand,
  systemOrigin,
} from "@platform/document-model";
import { documentUpdateChannel } from "@platform/shared/contracts";
import { createLogger } from "@platform/shared/node";
import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { connectClient, sleep, type TestClient, waitFor } from "../../test/realtime-client";
import type { RealtimeContext } from "../auth";
import { appendDocumentUpdates, loadStoredDocument } from "../persistence/documents.repository";
import { createRealtimeServer } from "../server";
import { PersistenceExtension } from "./persistence";
import { RedisBusExtension } from "./redis-bus";

// T1.12.8: redis-bus — update dari penulis sisi server diterima klien terhubung (ARCHITECTURE §5.5).
const SECRET = "test-realtime-secret-0123456789abcdef";
const logger = createLogger({ service: "realtime-test", env: "test", level: "silent" });
const tenant = systemScope("test redis-bus");

let testDb: TestDb;
let publisher: Redis;
let bus: RedisBusExtension;
let server: Server<RealtimeContext>;
let url: string;
const clients: TestClient[] = [];

beforeAll(async () => {
  testDb = await createTestDb();
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL kosong — jalankan lewat `pnpm test:integration` (memuat .env root).");
  publisher = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  bus = new RedisBusExtension({ subscriber: publisher.duplicate(), logger });
  server = createRealtimeServer({
    port: 0,
    host: "127.0.0.1",
    tokenSecret: SECRET,
    logger,
    extensions: [bus, new PersistenceExtension({ db: testDb.db, logger, flushDebounceMs: 50, flushMaxWaitMs: 200 })],
  });
  await server.listen();
  url = `ws://127.0.0.1:${server.address.port}`;
});
afterEach(() => {
  for (const client of clients.splice(0)) client.provider.destroy();
});
afterAll(async () => {
  await server.destroy();
  await publisher.quit();
  await testDb.drop();
});

async function seededSite() {
  const { user: owner } = await createUser(testDb.db);
  const { site, document } = await createSite(testDb.db, {
    workspace: await createWorkspace(testDb.db, { owner }),
  });
  const state = Y.encodeStateAsUpdate(jsonToYDoc(createBlankSiteDocument({ title: "Toko" })));
  await appendDocumentUpdates(testDb.db, tenant, document.id, [{ update: state, origin: "local" }]);
  return { owner, siteId: site.id, docId: document.id };
}

/** Penulis sisi server (mis. AI headless): muat dari DB, ubah lewat command, simpan update, lalu publish. */
async function serverWrite(docId: string, title: string, path: string): Promise<Uint8Array> {
  const stored = await loadStoredDocument(testDb.db, tenant, docId);
  const doc = loadDocument(stored?.snapshot?.state ?? null, stored?.updates ?? []);
  const before = Y.encodeStateVector(doc);
  const result = runCommand({ doc, origin: systemOrigin("import") }, createPage, { title, path });
  if (!result.ok) throw new Error(result.error.code);
  const update = Y.encodeStateAsUpdate(doc, before);
  await appendDocumentUpdates(testDb.db, tenant, docId, [{ update, origin: "server" }]);
  await publisher.publish(documentUpdateChannel(docId), Buffer.from(update));
  return update;
}

const pageTitles = (doc: Y.Doc) =>
  doc
    .getArray<string>("pageOrder")
    .toArray()
    .map((id) => ((doc.getMap("nodes").get(id) as Y.Map<unknown>).get("props") as Y.Map<unknown>).get("title"));

async function rowCount(docId: string) {
  return (await testDb.db.select().from(schema.documentUpdates).where(eq(schema.documentUpdates.documentId, docId)))
    .length;
}

describe("redis-bus", () => {
  it("update dari penulis server diterima klien terhubung & tidak disimpan ulang oleh persistence (AC T1.12.8)", async () => {
    const { owner, siteId, docId } = await seededSite();
    const client = await connectClient({ url, secret: SECRET, userId: owner.id, docId, siteId });
    clients.push(client);

    await serverWrite(docId, "Promo", "/promo");
    await waitFor(() => pageTitles(client.doc).includes("Promo"));
    // Baris: seed + tulisan server; flush persistence (50 ms) tidak menambah baris untuk origin server.
    await sleep(300);
    expect(await rowCount(docId)).toBe(2);
  });

  it("update yang tiba selama dokumen dimuat diantre lalu diterapkan (tidak hilang)", async () => {
    const docId = crypto.randomUUID();
    await bus.onLoadDocument({ documentName: docId } as never);
    const source = jsonToYDoc(createBlankSiteDocument({ title: "Antre" }));
    await publisher.publish(documentUpdateChannel(docId), Buffer.from(Y.encodeStateAsUpdate(source)));
    await sleep(150);
    const document = new Y.Doc() as Document;
    await bus.afterLoadDocument({ documentName: docId, document } as never);
    expect(pageTitles(document)).toEqual(pageTitles(source));
    await bus.afterUnloadDocument({ documentName: docId });
  });

  it("payload rusak tidak menjatuhkan server; update berikutnya tetap diterapkan", async () => {
    const { owner, siteId, docId } = await seededSite();
    const client = await connectClient({ url, secret: SECRET, userId: owner.id, docId, siteId });
    clients.push(client);
    await publisher.publish(documentUpdateChannel(docId), Buffer.from([1, 2, 3, 250, 251]));
    await serverWrite(docId, "Setelah", "/setelah");
    await waitFor(() => pageTitles(client.doc).includes("Setelah"));
  });

  it("dokumen di-unload → channel di-unsubscribe", async () => {
    const { owner, siteId, docId } = await seededSite();
    const client = await connectClient({ url, secret: SECRET, userId: owner.id, docId, siteId });
    const subscribers = async () =>
      ((await publisher.pubsub("NUMSUB", documentUpdateChannel(docId))) as [string, number])[1];
    expect(await subscribers()).toBe(1);
    client.provider.destroy();
    await waitFor(async () => (await subscribers()) === 0);
  });
});
