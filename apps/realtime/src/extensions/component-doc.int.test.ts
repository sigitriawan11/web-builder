import type { Server } from "@hocuspocus/server";
import { eq, schema } from "@platform/db";
import { createTestDb, createUser, type TestDb } from "@platform/db/testing";
import { CURRENT_COMPONENT_SCHEMA_VERSION, componentDefToState } from "@platform/document-model";
import { createLogger } from "@platform/shared/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connectClient, type TestClient, waitFor } from "../../test/realtime-client";
import type { RealtimeContext } from "../auth";
import { createRealtimeServer } from "../server";
import { PersistenceExtension } from "./persistence";
import { ProjectionsExtension } from "./projections";

// L4 (T3.4.2): dokumen `kind='component'` (Mode Admin) harus dimuat/disimpan realtime dengan schemaVersion SENDIRI —
// TIDAK dimigrasi/diproyeksikan sebagai SiteDocument (kalau salah, Y.Doc component terkorupsi oleh migrasi site).
const SECRET = "test-realtime-secret-0123456789abcdef";
const logger = createLogger({ service: "realtime-test", env: "test", level: "silent" });

let testDb: TestDb;
let server: Server<RealtimeContext>;
let url: string;
const clients: TestClient[] = [];

// ComponentDefinition minimal valid (frame root + teks).
const def = () => ({
  schemaVersion: 1,
  id: "cmp_l4test0001",
  version: 1,
  name: "L4 Card",
  category: "card" as const,
  propsSchema: [],
  rootId: "n_root0001",
  nodes: {
    n_root0001: {
      id: "n_root0001",
      type: "frame",
      name: "Card",
      parentId: null,
      visible: true,
      locked: false,
      tag: "div",
      children: [],
      style: { base: {} },
      props: {},
    },
  },
});

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

// Seed dokumen draft component (seperti api createComponent): documents kind=component + snapshot uptoSeq 0.
async function seedComponentDoc(): Promise<string> {
  const [doc] = await testDb.db
    .insert(schema.documents)
    .values({ kind: "component", schemaVersion: CURRENT_COMPONENT_SCHEMA_VERSION })
    .returning({ id: schema.documents.id });
  const documentId = doc?.id ?? "";
  const state = componentDefToState(def());
  const [snap] = await testDb.db
    .insert(schema.documentSnapshots)
    .values({ documentId, uptoSeq: 0, state, json: def(), kind: "auto" })
    .returning({ id: schema.documentSnapshots.id });
  await testDb.db
    .update(schema.documents)
    .set({ lastSnapshotId: snap?.id, sizeBytes: state.byteLength })
    .where(eq(schema.documents.id, documentId));
  return documentId;
}

describe("dokumen component via realtime (T3.4.2 L4)", () => {
  it("dimuat tanpa ditolak; edit tersimpan; schemaVersion tetap (bukan dimigrasi ke versi site); snapshot valid", async () => {
    const documentId = await seedComponentDoc();
    const { user } = await createUser(testDb.db);
    const client = await connectClient({
      url,
      secret: SECRET,
      userId: user.id,
      docId: documentId,
      siteId: null,
      role: "editor",
      kind: "component",
    });
    clients.push(client);

    // Dokumen termuat: meta component ada.
    expect(client.doc.getMap("meta").get("name")).toBe("L4 Card");

    // Edit (ubah nama di meta) → tersimpan.
    client.doc.getMap("meta").set("name", "L4 Card Diubah");
    await waitFor(async () => {
      const [row] = await testDb.db.select().from(schema.documents).where(eq(schema.documents.id, documentId));
      return (row?.lastSeq ?? 0) >= 1;
    });

    // schemaVersion TETAP versi component (tidak dibandingkan/dimigrasi dengan versi site 8).
    const [row] = await testDb.db.select().from(schema.documents).where(eq(schema.documents.id, documentId));
    expect(row?.schemaVersion).toBe(CURRENT_COMPONENT_SCHEMA_VERSION);
    expect(row?.kind).toBe("component");

    // Tidak ada proyeksi situs untuk dokumen component.
    const pages = await testDb.db.select().from(schema.sitePages);
    const usage = await testDb.db.select().from(schema.siteComponentUsage);
    expect(pages).toHaveLength(0);
    expect(usage).toHaveLength(0);
  });
});
