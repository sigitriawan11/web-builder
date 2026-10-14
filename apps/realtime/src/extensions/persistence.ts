import type { Extension, onLoadDocumentPayload } from "@hocuspocus/server";
import { type Db, systemScope } from "@platform/db";
import { CURRENT_SCHEMA_VERSION, loadDocument, migrateYDoc } from "@platform/document-model";
import type { Logger } from "@platform/shared/node";
import * as Y from "yjs";
import type { RealtimeContext } from "../auth";
import { appendDocumentUpdates, loadStoredDocument } from "../persistence/documents.repository";

// ARCHITECTURE §5.5/§7.3: persistence custom (append-only, bukan @hocuspocus/extension-database).
// Load = snapshot terbaru + update seq > upto_seq → migrasi schemaVersion bila perlu (origin `migration`).
// Tulis update (buffer & flush) = T1.12.3.

export class PersistenceExtension implements Extension {
  constructor(private readonly options: { db: Db; logger: Logger }) {}

  async onLoadDocument({ documentName, document }: onLoadDocumentPayload<RealtimeContext>): Promise<void> {
    const tenant = systemScope("realtime: muat dokumen untuk koneksi terautentikasi");
    const stored = await loadStoredDocument(this.options.db, tenant, documentName);
    // Dokumen dibuat api bersama situs; tidak ada → koneksi gagal (bukan membuat dokumen kosong diam-diam).
    if (!stored) throw new Error(`dokumen ${documentName} tidak ditemukan`);

    const loaded = loadDocument(stored.snapshot?.state ?? null, stored.updates);
    try {
      if (stored.schemaVersion < CURRENT_SCHEMA_VERSION) await this.migrate(documentName, loaded);
      Y.applyUpdate(document, Y.encodeStateAsUpdate(loaded));
    } finally {
      loaded.destroy();
    }
    this.options.logger.debug(
      { docId: documentName, lastSeq: stored.lastSeq, updates: stored.updates.length },
      "dokumen dimuat",
    );
  }

  // DM-071: migrasi saat load; hasilnya LANGSUNG disimpan sebagai update ber-origin `migration` (+ schema_version)
  // agar tidak bergantung pada flush klien dan tidak dijalankan ulang di load berikutnya.
  private async migrate(documentId: string, doc: Y.Doc): Promise<void> {
    const before = Y.encodeStateVector(doc);
    const result = migrateYDoc(doc);
    const update = Y.encodeStateAsUpdate(doc, before);
    await appendDocumentUpdates(
      this.options.db,
      systemScope("realtime: simpan hasil migrasi schemaVersion"),
      documentId,
      result.applied.length > 0 ? [{ update, origin: "migration" }] : [],
      { schemaVersion: result.toVersion },
    );
    this.options.logger.info(
      { docId: documentId, from: result.fromVersion, to: result.toVersion },
      "dokumen dimigrasi",
    );
  }
}
