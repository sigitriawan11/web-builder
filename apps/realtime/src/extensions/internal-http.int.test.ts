import type { Server } from "@hocuspocus/server";
import { eq, schema, systemScope } from "@platform/db";
import { createSite, createTestDb, createUser, createWorkspace, type TestDb } from "@platform/db/testing";
import {
  CURRENT_SCHEMA_VERSION,
  createBlankSiteDocument,
  createNode,
  jsonToYDoc,
  runCommand,
  SiteDocumentSchema,
  userOrigin,
  yDocToJson,
} from "@platform/document-model";
import { uuidv7 } from "@platform/shared";
import { DOCUMENT_STATE_HEADERS } from "@platform/shared/contracts";
import { createLogger, type InternalService, signInternalToken } from "@platform/shared/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { connectClient, type TestClient } from "../../test/realtime-client";
import type { RealtimeContext } from "../auth";
import { appendDocumentUpdates } from "../persistence/documents.repository";
import { createRealtimeServer } from "../server";
import { InternalHttpExtension } from "./internal-http";
import { PersistenceExtension } from "./persistence";

// T1.12.9: internal-http — state dokumen untuk worker (in-memory vs DB) + health (ARCHITECTURE §5.5, §9.3).
const SECRET = "test-realtime-secret-0123456789abcdef";
const INTERNAL_SECRET = "test-internal-secret-0123456789abcdef";
const logger = createLogger({ service: "realtime-test", env: "test", level: "silent" });

let testDb: TestDb;
let server: Server<RealtimeContext>;
let base: string;
let redisHealthy = true;
const clients: TestClient[] = [];

beforeAll(async () => {
  testDb = await createTestDb();
  // Debounce flush panjang: state in-memory sengaja di depan DB sampai endpoint memaksa flush.
  const persistence = new PersistenceExtension({
    db: testDb.db,
    logger,
    flushDebounceMs: 60_000,
    flushMaxWaitMs: 60_000,
  });
  server = createRealtimeServer({
    port: 0,
    host: "127.0.0.1",
    tokenSecret: SECRET,
    logger,
    extensions: [
      persistence,
      new InternalHttpExtension({
        db: testDb.db,
        logger,
        internalSecret: INTERNAL_SECRET,
        persistence,
        readinessTimeoutMs: 200,
        readinessChecks: {
          db: () => testDb.db.execute("select 1"),
          redis: () => (redisHealthy ? Promise.resolve("PONG") : Promise.reject(new Error("down"))),
        },
      }),
    ],
  });
  await server.listen();
  base = `http://127.0.0.1:${server.address.port}`;
});
afterEach(() => {
  for (const client of clients.splice(0)) client.provider.destroy();
  redisHealthy = true;
});
afterAll(async () => {
  await server.destroy();
  await testDb.drop();
});

async function seededSite() {
  const { user: owner } = await createUser(testDb.db);
  const { site, document } = await createSite(testDb.db, {
    workspace: await createWorkspace(testDb.db, { owner }),
  });
  const source = jsonToYDoc(createBlankSiteDocument({ title: "Toko" }));
  await appendDocumentUpdates(testDb.db, systemScope("test internal-http"), document.id, [
    { update: Y.encodeStateAsUpdate(source), origin: "local" },
  ]);
  return { owner, siteId: site.id, docId: document.id, source };
}

async function getState(docId: string, service: InternalService = "worker", audience: InternalService = "realtime") {
  const token = await signInternalToken(INTERNAL_SECRET, { service, audience });
  return fetch(`${base}/internal/documents/${docId}/state`, { headers: { authorization: `Bearer ${token}` } });
}

async function stateJson(response: Response) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(await response.arrayBuffer()));
  return SiteDocumentSchema.parse(yDocToJson(doc));
}

describe("health", () => {
  it("live 200; ready 200 bila semua cek lolos, 503 bila ada yang gagal", async () => {
    expect((await fetch(`${base}/health/live`)).status).toBe(200);
    const ready = await fetch(`${base}/health/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: "ready", checks: { db: "ok", redis: "ok" } });

    redisHealthy = false;
    const down = await fetch(`${base}/health/ready`);
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ status: "not_ready", checks: { db: "ok", redis: "fail" } });
  });
});

describe("GET /internal/documents/:id/state", () => {
  it("tanpa token / audience lain → 401; service selain worker & api → 403; id tak valid / tak ada → 404", async () => {
    const { docId } = await seededSite();
    expect((await fetch(`${base}/internal/documents/${docId}/state`)).status).toBe(401);
    expect((await getState(docId, "worker", "api")).status).toBe(401);
    const forbidden = await getState(docId, "web");
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect((await getState("bukan-uuid")).status).toBe(404);
    expect((await getState(uuidv7())).status).toBe(404);
    expect((await getState(docId, "api")).status).toBe(200);
  });

  it("dokumen tidak dibuka → state dari DB (`source: db`) + seq & schemaVersion", async () => {
    const { docId, source } = await seededSite();
    const response = await getState(docId);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get(DOCUMENT_STATE_HEADERS.source)).toBe("db");
    expect(response.headers.get(DOCUMENT_STATE_HEADERS.seq)).toBe("1");
    expect(response.headers.get(DOCUMENT_STATE_HEADERS.schemaVersion)).toBe(String(CURRENT_SCHEMA_VERSION));
    expect(await stateJson(response)).toEqual(SiteDocumentSchema.parse(yDocToJson(source)));
  });

  it("dokumen sedang dibuka → state in-memory (edit belum di-flush ikut), buffer di-flush dulu → seq mencakupnya (AC T1.12.9)", async () => {
    const { owner, siteId, docId } = await seededSite();
    const client = await connectClient({
      url: base.replace("http", "ws"),
      secret: SECRET,
      userId: owner.id,
      docId,
      siteId,
    });
    clients.push(client);
    const pageId = client.doc.getArray<string>("pageOrder").get(0);
    runCommand({ doc: client.doc, origin: userOrigin("test") }, createNode, {
      parentId: pageId,
      type: "frame",
      name: "Baru",
    });
    const expected = SiteDocumentSchema.parse(yDocToJson(client.doc));
    // Tunggu server menerima update (belum di-flush: debounce 60 s).
    await new Promise((resolve) => setTimeout(resolve, 200));
    const rowsBefore = await testDb.db
      .select()
      .from(schema.documentUpdates)
      .where(eq(schema.documentUpdates.documentId, docId));
    expect(rowsBefore).toHaveLength(1);

    const response = await getState(docId);
    expect(response.headers.get(DOCUMENT_STATE_HEADERS.source)).toBe("memory");
    expect(response.headers.get(DOCUMENT_STATE_HEADERS.seq)).toBe("2");
    expect(await stateJson(response)).toEqual(expected);
    // DB kini sama dengan memory (flush paksa).
    const fromDb = await getStateFromDbAfterUnload(client, docId);
    expect(fromDb).toEqual(expected);
  });

  it("path lain di luar /internal & /health tetap dijawab Hocuspocus; method selain GET → 405", async () => {
    expect((await fetch(`${base}/`)).status).toBe(200);
    expect((await fetch(`${base}/internal/documents/x/state`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${base}/internal/lain`)).status).toBe(404);
  });
});

async function getStateFromDbAfterUnload(client: TestClient, docId: string) {
  client.provider.destroy();
  const deadline = Date.now() + 3000;
  for (;;) {
    const response = await getState(docId);
    if (response.headers.get(DOCUMENT_STATE_HEADERS.source) === "db") return stateJson(response);
    if (Date.now() > deadline) throw new Error("dokumen tidak di-unload");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
