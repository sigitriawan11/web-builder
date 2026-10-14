import { HocuspocusProvider } from "@hocuspocus/provider";
import type { Server } from "@hocuspocus/server";
import { asc, eq, schema, systemScope } from "@platform/db";
import { createSite, createTestDb, createUser, createWorkspace, type TestDb } from "@platform/db/testing";
import {
  createBlankSiteDocument,
  createNode,
  jsonToYDoc,
  runCommand,
  SiteDocumentSchema,
  userOrigin,
  yDocToJson,
} from "@platform/document-model";
import { REALTIME_TOKEN_AUDIENCE } from "@platform/shared/contracts";
import { createLogger, signToken } from "@platform/shared/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { RealtimeContext } from "../auth";
import { appendDocumentUpdates } from "../persistence/documents.repository";
import { createRealtimeServer } from "../server";
import { LIMIT_WARNING_MESSAGE, PersistenceExtension, type PersistenceOptions } from "./persistence";

// T1.12.3: buffer update klien → flush satu baris (debounce + batas tunggu maksimum), flush paksa saat putus,
// batas ukuran state (ARCHITECTURE §7.2, DM-061/DM-076).
const SECRET = "test-realtime-secret-0123456789abcdef";
const logger = createLogger({ service: "realtime-test", env: "test", level: "silent" });
const tenant = systemScope("test realtime flush");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let testDb: TestDb;
let server: Server<RealtimeContext> | undefined;
let url: string;
const providers: HocuspocusProvider[] = [];

beforeAll(async () => {
  testDb = await createTestDb();
});
afterEach(async () => {
  for (const provider of providers.splice(0)) provider.destroy();
  await server?.destroy();
  server = undefined;
});
afterAll(async () => {
  await testDb.drop();
});

async function start(options: Omit<PersistenceOptions, "db" | "logger">): Promise<void> {
  server = createRealtimeServer({
    port: 0,
    host: "127.0.0.1",
    tokenSecret: SECRET,
    logger,
    extensions: [new PersistenceExtension({ db: testDb.db, logger, ...options })],
  });
  await server.listen();
  url = `ws://127.0.0.1:${server.address.port}`;
}

/** Situs dengan dokumen awal tersimpan (seq 1); kembalikan juga ukuran state awalnya. */
async function seededSite() {
  const { user: owner } = await createUser(testDb.db);
  const { site, document } = await createSite(testDb.db, {
    workspace: await createWorkspace(testDb.db, { owner }),
  });
  const state = Y.encodeStateAsUpdate(jsonToYDoc(createBlankSiteDocument({ title: "Toko" })));
  await appendDocumentUpdates(testDb.db, tenant, document.id, [{ update: state, origin: "local" }]);
  return { owner, siteId: site.id, docId: document.id, initialBytes: state.byteLength };
}

interface Client {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  stateless: string[];
  closed: Promise<void>;
}

async function connect(userId: string, docId: string, siteId: string): Promise<Client> {
  const token = await signToken(
    SECRET,
    { sub: userId, docId, siteId, role: "owner" },
    { expiresInSeconds: 300, audience: REALTIME_TOKEN_AUDIENCE },
  );
  const doc = new Y.Doc();
  const stateless: string[] = [];
  let onClose = () => {};
  const closed = new Promise<void>((resolve) => {
    onClose = resolve;
  });
  const provider = await new Promise<HocuspocusProvider>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("tidak tersinkron")), 5000);
    const created: HocuspocusProvider = new HocuspocusProvider({
      url,
      name: docId,
      token,
      document: doc,
      onStateless: ({ payload }) => stateless.push(payload),
      onClose: () => onClose(),
      onSynced: () => {
        clearTimeout(timer);
        resolve(created);
      },
    });
    providers.push(created);
  });
  return { doc, provider, stateless, closed };
}

function addFrames(doc: Y.Doc, count: number, prefix = "F"): void {
  const pageId = doc.getArray<string>("pageOrder").get(0);
  for (let i = 0; i < count; i++) {
    const result = runCommand({ doc, origin: userOrigin("client") }, createNode, {
      parentId: pageId,
      type: "frame",
      name: `${prefix}${i}`,
    });
    if (!result.ok) throw new Error(result.error.code);
  }
}

async function storedRows(docId: string) {
  return testDb.db
    .select({
      seq: schema.documentUpdates.seq,
      origin: schema.documentUpdates.origin,
      actorId: schema.documentUpdates.actorId,
    })
    .from(schema.documentUpdates)
    .where(eq(schema.documentUpdates.documentId, docId))
    .orderBy(asc(schema.documentUpdates.seq));
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("kondisi tidak terpenuhi");
    await sleep(25);
  }
}

describe("flush update", () => {
  it("50 edit beruntun → digabung jadi sedikit baris, seq tanpa bolong, load ulang identik (AC T1.12.3)", async () => {
    await start({ flushDebounceMs: 150, flushMaxWaitMs: 2000 });
    const { owner, siteId, docId, initialBytes } = await seededSite();
    const client = await connect(owner.id, docId, siteId);
    addFrames(client.doc, 50);

    await waitFor(async () => (await storedRows(docId)).length > 1);
    await sleep(300);
    const rows = await storedRows(docId);
    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows.map((row) => row.seq)).toEqual(rows.map((_, index) => index + 1));
    expect(rows.slice(1).every((row) => row.origin === "local" && row.actorId === owner.id)).toBe(true);
    const [documentRow] = await testDb.db.select().from(schema.documents).where(eq(schema.documents.id, docId));
    expect(documentRow?.lastSeq).toBe(rows.length);
    expect(documentRow?.sizeBytes).toBeGreaterThan(initialBytes);

    // Server baru (memori kosong) memuat dari DB → identik dengan klien.
    const expected = SiteDocumentSchema.parse(yDocToJson(client.doc));
    client.provider.destroy();
    await server?.destroy();
    await start({});
    const reloaded = await connect(owner.id, docId, siteId);
    expect(SiteDocumentSchema.parse(yDocToJson(reloaded.doc))).toEqual(expected);
  });

  it("edit terus-menerus tidak menunda flush melewati batas tunggu maksimum", async () => {
    await start({ flushDebounceMs: 200, flushMaxWaitMs: 300 });
    const { owner, siteId, docId } = await seededSite();
    const client = await connect(owner.id, docId, siteId);
    // Edit tiap 40 ms (< debounce) selama ~800 ms: tanpa batas maksimum, debounce tidak pernah habis.
    for (let i = 0; i < 20; i++) {
      addFrames(client.doc, 1, `T${i}-`);
      await sleep(40);
    }
    expect((await storedRows(docId)).length).toBeGreaterThanOrEqual(3);
  });

  it("klien putus → buffer di-flush paksa walau debounce belum habis", async () => {
    await start({ flushDebounceMs: 60_000, flushMaxWaitMs: 60_000 });
    const { owner, siteId, docId } = await seededSite();
    const client = await connect(owner.id, docId, siteId);
    addFrames(client.doc, 3);
    await sleep(100);
    expect(await storedRows(docId)).toHaveLength(1);

    const expected = SiteDocumentSchema.parse(yDocToJson(client.doc));
    client.provider.destroy();
    await waitFor(async () => (await storedRows(docId)).length === 2);
    await sleep(200);
    const reloaded = await connect(owner.id, docId, siteId);
    expect(SiteDocumentSchema.parse(yDocToJson(reloaded.doc))).toEqual(expected);
  });

  it("server shutdown → buffer di-flush (onDestroy)", async () => {
    await start({ flushDebounceMs: 60_000, flushMaxWaitMs: 60_000 });
    const { owner, siteId, docId } = await seededSite();
    const client = await connect(owner.id, docId, siteId);
    addFrames(client.doc, 2);
    await sleep(100);
    await server?.destroy();
    server = undefined;
    expect(await storedRows(docId)).toHaveLength(2);
  });
});

describe("batas ukuran state (DM-076)", () => {
  it("lewat batas soft → peringatan stateless sekali; lewat batas hard → pesan ditolak & tidak tersimpan", async () => {
    const { owner, siteId, docId, initialBytes } = await seededSite();
    await start({
      flushDebounceMs: 50,
      flushMaxWaitMs: 200,
      stateLimits: { soft: initialBytes + 2_000, hard: initialBytes + 20_000 },
    });
    const client = await connect(owner.id, docId, siteId);
    // Sengaja menulis Y.Map mentah (bukan command): yang diuji transport & batas byte, bukan isi dokumen.
    const scratch = client.doc.getMap("scratch");
    scratch.set("a", "x".repeat(3_000));
    await waitFor(async () => client.stateless.length > 0);
    scratch.set("b", "y".repeat(500));
    await waitFor(async () => (await storedRows(docId)).length >= 2);
    expect(client.stateless).toHaveLength(1);
    expect(JSON.parse(client.stateless[0] ?? "{}")).toMatchObject({
      type: LIMIT_WARNING_MESSAGE,
      limit: "yDocStateBytes",
    });

    const before = await storedRows(docId);
    scratch.set("c", "z".repeat(30_000));
    await client.closed;
    client.provider.destroy();
    await sleep(300);
    expect(await storedRows(docId)).toEqual(before);
  });
});
