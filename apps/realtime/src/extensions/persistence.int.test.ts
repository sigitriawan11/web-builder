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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { RealtimeContext } from "../auth";
import { appendDocumentUpdates } from "../persistence/documents.repository";
import { createRealtimeServer } from "../server";
import { PersistenceExtension } from "./persistence";

// T1.12.2: persistence onLoadDocument (snapshot + update seq > upto) + migrasi schemaVersion (ARCHITECTURE §7.3, DM-071).
const SECRET = "test-realtime-secret-0123456789abcdef";
const logger = createLogger({ service: "realtime-test", env: "test", level: "silent" });
const tenant = systemScope("test realtime persistence");
let testDb: TestDb;
let server: Server<RealtimeContext>;
let url: string;

beforeAll(async () => {
  testDb = await createTestDb();
  server = createRealtimeServer({
    port: 0,
    host: "127.0.0.1",
    tokenSecret: SECRET,
    logger,
    extensions: [new PersistenceExtension({ db: testDb.db, logger })],
  });
  await server.listen();
  url = `ws://127.0.0.1:${server.address.port}`;
});
afterAll(async () => {
  await server.destroy();
  await testDb.drop();
});

async function siteDocument(schemaVersion = 1) {
  const { user: owner } = await createUser(testDb.db);
  const workspace = await createWorkspace(testDb.db, { owner });
  const { site, document } = await createSite(testDb.db, { workspace, schemaVersion });
  return { owner, site, document };
}

/** Sambungkan provider sampai tersinkron; kembalikan isi dokumen klien (lalu putus). */
async function syncedJson(userId: string, docId: string, siteId: string | null): Promise<unknown> {
  const token = await signToken(
    SECRET,
    { sub: userId, docId, siteId, role: "owner" },
    { expiresInSeconds: 300, audience: REALTIME_TOKEN_AUDIENCE },
  );
  const doc = new Y.Doc();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      provider.destroy();
      reject(new Error("tidak tersinkron"));
    }, 5000);
    const provider = new HocuspocusProvider({
      url,
      name: docId,
      token,
      document: doc,
      onSynced: () => {
        clearTimeout(timer);
        const json = yDocToJson(doc);
        provider.destroy();
        resolve(json);
      },
    });
  });
}

describe("onLoadDocument", () => {
  it("snapshot (seq 40) + 100 update → klien menerima dokumen identik (AC T1.12.2)", async () => {
    const { owner, site, document } = await siteDocument();
    // Dokumen hidup: state awal + 99 command, setiap transaksi = satu update tersimpan.
    const live = new Y.Doc();
    const updates: Uint8Array[] = [];
    live.on("update", (update: Uint8Array) => updates.push(update));
    jsonToYDoc(createBlankSiteDocument({ title: "Toko" }), live);
    const pageId = (live.getArray<string>("pageOrder").toArray()[0] ?? "") as string;
    for (let i = 0; i < 99; i++) {
      const result = runCommand({ doc: live, origin: userOrigin("seed") }, createNode, {
        parentId: pageId,
        type: "frame",
        name: `F${i}`,
      });
      expect(result.ok).toBe(true);
    }
    expect(updates).toHaveLength(100);
    await appendDocumentUpdates(
      testDb.db,
      tenant,
      document.id,
      updates.map((update) => ({ update, origin: "local" as const })),
    );

    // Snapshot mencakup seq 1..40.
    const snapshotDoc = new Y.Doc();
    for (const update of updates.slice(0, 40)) Y.applyUpdate(snapshotDoc, update);
    const [snapshot] = await testDb.db
      .insert(schema.documentSnapshots)
      .values({ documentId: document.id, uptoSeq: 40, state: Y.encodeStateAsUpdate(snapshotDoc), kind: "auto" })
      .returning();
    await testDb.db
      .update(schema.documents)
      .set({ lastSnapshotId: snapshot?.id })
      .where(eq(schema.documents.id, document.id));

    const received = await syncedJson(owner.id, document.id, site.id);
    expect(SiteDocumentSchema.parse(received)).toEqual(SiteDocumentSchema.parse(yDocToJson(live)));
  });

  it("dokumen v0 dimigrasi saat load: update origin `migration` tersimpan, schema_version naik, tidak diulang", async () => {
    const { owner, site, document } = await siteDocument(0);
    // Dokumen v0 (prototipe M0): tanpa settings/theme/componentDeps, schemaVersion 0.
    const v0 = createBlankSiteDocument({ title: "Lama" });
    const legacy = jsonToYDoc(v0);
    legacy.transact(() => {
      legacy.getMap("meta").set("schemaVersion", 0);
      for (const key of ["settings", "theme", "componentDeps"]) {
        const map = legacy.getMap(key);
        for (const name of [...map.keys()]) map.delete(name);
      }
    });
    await appendDocumentUpdates(testDb.db, tenant, document.id, [
      { update: Y.encodeStateAsUpdate(legacy), origin: "local" },
    ]);

    const received = SiteDocumentSchema.parse(await syncedJson(owner.id, document.id, site.id));
    expect(received.schemaVersion).toBe(1);
    expect(received.settings.language).toBe("id");
    expect(received.nodes).toEqual(v0.nodes);

    const rows = await testDb.db
      .select({ seq: schema.documentUpdates.seq, origin: schema.documentUpdates.origin })
      .from(schema.documentUpdates)
      .where(eq(schema.documentUpdates.documentId, document.id));
    expect(rows).toEqual([
      { seq: 1, origin: "local" },
      { seq: 2, origin: "migration" },
    ]);
    const [after] = await testDb.db.select().from(schema.documents).where(eq(schema.documents.id, document.id));
    expect(after).toMatchObject({ schemaVersion: 1, lastSeq: 2 });

    // Snapshot `migration` sebelum (JSON v0, tidak valid untuk schema terkini) & sesudah (valid, titik awal load).
    const snapshots = await testDb.db
      .select()
      .from(schema.documentSnapshots)
      .where(eq(schema.documentSnapshots.documentId, document.id))
      .orderBy(asc(schema.documentSnapshots.uptoSeq));
    expect(snapshots.map(({ kind, uptoSeq, jsonInvalid }) => ({ kind, uptoSeq, jsonInvalid }))).toEqual([
      { kind: "migration", uptoSeq: 1, jsonInvalid: true },
      { kind: "migration", uptoSeq: 2, jsonInvalid: false },
    ]);
    expect(snapshots[0]?.json).toMatchObject({ schemaVersion: 0 });
    expect(SiteDocumentSchema.parse(snapshots[1]?.json)).toEqual(received);
    expect(after?.lastSnapshotId).toBe(snapshots[1]?.id);

    // Dokumen di-unload saat klien terakhir putus; load ulang dari DB tidak memigrasi lagi.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(SiteDocumentSchema.parse(await syncedJson(owner.id, document.id, site.id))).toEqual(received);
    const again = await testDb.db
      .select()
      .from(schema.documentUpdates)
      .where(eq(schema.documentUpdates.documentId, document.id));
    expect(again).toHaveLength(2);
  });

  it("dokumen tidak ada di DB → tidak pernah tersinkron", async () => {
    const { user: owner } = await createUser(testDb.db);
    await expect(syncedJson(owner.id, "0199f0aa-0000-7000-8000-00000000abcd", null)).rejects.toThrow(
      /tidak tersinkron/,
    );
  });
});
