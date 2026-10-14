import { eq, schema } from "@platform/db";
import { createSite, createTestDb, createUser, type TestDb } from "@platform/db/testing";
import {
  createBlankSiteDocument,
  SiteDocumentSchema,
  siteDocumentFromState,
  siteDocumentToState,
  YDOC_KEYS,
} from "@platform/document-model";
import { uuidv7 } from "@platform/shared";
import { DOCUMENT_STATE_HEADERS } from "@platform/shared/contracts";
import { type InternalService, signInternalToken } from "@platform/shared/node";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createApp } from "../../app";
import { silentLogger } from "../../test-utils";

// T1.6.5 (ARCHITECTURE §5.5, §7.3): state Yjs terbaru dari DB (snapshot + update setelahnya) untuk worker/realtime.
const SECRET = "internal-secret-0123456789abcdefghij";
let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

const app = () => createApp({ logger: silentLogger(), db: testDb.db, internalJwtSecret: SECRET });
const token = (service: InternalService) => signInternalToken(SECRET, { service, audience: "api" });

/** Dokumen situs: snapshot mencakup seq 1; update seq 1 (sudah tercakup) & seq 2 (baru) di document_updates. */
async function documentWithHistory() {
  const { workspace } = await createUser(testDb.db);
  const { document } = await createSite(testDb.db, { workspace });
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, siteDocumentToState(createBlankSiteDocument({ title: "Awal" })));
  const captured: Uint8Array[] = [];
  ydoc.on("update", (update: Uint8Array) => captured.push(update));
  ydoc.getMap(YDOC_KEYS.meta).set("title", "Seq 1");
  const snapshotState = Y.encodeStateAsUpdate(ydoc);
  ydoc.getMap(YDOC_KEYS.meta).set("title", "Seq 2");

  const [snapshot] = await testDb.db
    .insert(schema.documentSnapshots)
    .values({ documentId: document.id, uptoSeq: 1, state: snapshotState, kind: "auto" })
    .returning();
  await testDb.db.insert(schema.documentUpdates).values([
    { documentId: document.id, seq: 1, update: captured[0] ?? new Uint8Array(), origin: "local" },
    { documentId: document.id, seq: 2, update: captured[1] ?? new Uint8Array(), origin: "local" },
  ]);
  await testDb.db
    .update(schema.documents)
    .set({ lastSnapshotId: snapshot?.id ?? null, lastSeq: 2 })
    .where(eq(schema.documents.id, document.id));
  return document;
}

const getState = (documentId: string, authorization?: string) => {
  const call = request(app())
    .get(`/internal/v1/documents/${documentId}/state`)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });
  return authorization ? call.set("authorization", authorization) : call;
};

describe("GET /internal/v1/documents/:id/state", () => {
  it("worker → state biner = snapshot + update setelahnya; metadata di header", async () => {
    const document = await documentWithHistory();
    const response = await getState(document.id, `Bearer ${await token("worker")}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/octet-stream");
    expect(response.headers[DOCUMENT_STATE_HEADERS.seq]).toBe("2");
    expect(response.headers[DOCUMENT_STATE_HEADERS.schemaVersion]).toBe("1");
    expect(response.headers[DOCUMENT_STATE_HEADERS.source]).toBe("db");
    const json = siteDocumentFromState(new Uint8Array(response.body as Buffer));
    expect(SiteDocumentSchema.parse(json).meta.title).toBe("Seq 2");
  });

  it("realtime juga boleh; service lain (web) → 403", async () => {
    const document = await documentWithHistory();
    expect((await getState(document.id, `Bearer ${await token("realtime")}`)).status).toBe(200);
    expect((await getState(document.id, `Bearer ${await token("web")}`)).status).toBe(403);
  });

  it("tanpa token → 401; dokumen tidak ada / ID tidak valid → 404", async () => {
    const document = await documentWithHistory();
    expect((await getState(document.id)).status).toBe(401);
    const auth = `Bearer ${await token("worker")}`;
    expect((await getState(uuidv7(), auth)).status).toBe(404);
    expect((await getState("bukan-uuid", auth)).status).toBe(404);
  });
});
