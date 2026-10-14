import type {
  beforeHandleMessagePayload,
  Extension,
  onChangePayload,
  onDisconnectPayload,
  onLoadDocumentPayload,
} from "@hocuspocus/server";
import { type Db, systemScope } from "@platform/db";
import { CURRENT_SCHEMA_VERSION, DOCUMENT_LIMITS, loadDocument, migrateYDoc } from "@platform/document-model";
import type { Logger } from "@platform/shared/node";
import * as Y from "yjs";
import type { RealtimeContext } from "../auth";
import { appendDocumentUpdates, loadStoredDocument } from "../persistence/documents.repository";

// ARCHITECTURE §5.5/§7: persistence custom (append-only, bukan @hocuspocus/extension-database).
// Load (§7.3) = snapshot terbaru + update seq > upto_seq → migrasi schemaVersion bila perlu (origin `migration`).
// Tulis (§7.2) = update klien di-buffer per dokumen → flush (debounce, dengan batas tunggu maksimum) sebagai SATU
// baris `Y.mergeUpdates(buffer)` + `last_seq` dalam satu transaksi; flush paksa saat klien putus & saat shutdown.

export interface PersistenceOptions {
  db: Db;
  logger: Logger;
  // ARCHITECTURE §7.2: debounce 2 s, maksimum 10 s sejak update pertama di buffer.
  flushDebounceMs?: number;
  flushMaxWaitMs?: number;
  // DM-076/DM-061: batas ukuran state Yjs (default DOCUMENT_LIMITS.yDocStateBytes).
  stateLimits?: { soft: number; hard: number };
}

interface DocumentBuffer {
  updates: Uint8Array[];
  bytes: number;
  actorId: string | null;
  firstAt: number;
  timer?: ReturnType<typeof setTimeout> | undefined;
  // Ukuran state terakhir yang diketahui (load/flush) — dasar estimasi batas tanpa encode ulang tiap pesan.
  stateBytes: number;
  // Dokumen live (dari onChange) — ukuran state dihitung ulang darinya saat flush.
  document: Y.Doc | null;
  warned: boolean;
  // Flush per dokumen berurutan agar seq tidak bertukar urutan.
  flushing: Promise<void>;
}

export const LIMIT_WARNING_MESSAGE = "limit-warning";

export class PersistenceExtension implements Extension {
  private readonly buffers = new Map<string, DocumentBuffer>();
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly limits: { soft: number; hard: number };

  constructor(private readonly options: PersistenceOptions) {
    this.debounceMs = options.flushDebounceMs ?? 2000;
    this.maxWaitMs = options.flushMaxWaitMs ?? 10_000;
    this.limits = options.stateLimits ?? DOCUMENT_LIMITS.yDocStateBytes;
  }

  async onLoadDocument({ documentName, document }: onLoadDocumentPayload<RealtimeContext>): Promise<void> {
    const tenant = systemScope("realtime: muat dokumen untuk koneksi terautentikasi");
    const stored = await loadStoredDocument(this.options.db, tenant, documentName);
    // Dokumen dibuat api bersama situs; tidak ada → koneksi gagal (bukan membuat dokumen kosong diam-diam).
    if (!stored) throw new Error(`dokumen ${documentName} tidak ditemukan`);

    const loaded = loadDocument(stored.snapshot?.state ?? null, stored.updates);
    try {
      if (stored.schemaVersion < CURRENT_SCHEMA_VERSION) await this.migrate(documentName, loaded);
      const state = Y.encodeStateAsUpdate(loaded);
      Y.applyUpdate(document, state);
      this.buffer(documentName).stateBytes = state.byteLength;
    } finally {
      loaded.destroy();
    }
    this.options.logger.debug(
      { docId: documentName, lastSeq: stored.lastSeq, updates: stored.updates.length },
      "dokumen dimuat",
    );
  }

  // AC DM-061/DM-076: tolak pesan yang membuat state melewati batas hard (estimasi konservatif: ukuran terakhir +
  // buffer + panjang pesan, karena hasil merge ≤ jumlahnya); lewat batas soft → peringatan sekali ke klien.
  async beforeHandleMessage({
    documentName,
    update,
    connection,
  }: beforeHandleMessagePayload<RealtimeContext>): Promise<void> {
    const buffer = this.buffers.get(documentName);
    if (!buffer) return;
    const estimate = buffer.stateBytes + buffer.bytes + update.byteLength;
    if (estimate > this.limits.hard) {
      this.options.logger.warn(
        { docId: documentName, estimate, max: this.limits.hard },
        "update ditolak: state melewati batas",
      );
      throw new Error("document-too-large");
    }
    if (estimate > this.limits.soft && !buffer.warned) {
      buffer.warned = true;
      connection.sendStateless(
        JSON.stringify({
          type: LIMIT_WARNING_MESSAGE,
          limit: "yDocStateBytes",
          bytes: estimate,
          max: this.limits.soft,
        }),
      );
    }
  }

  async onChange({ documentName, document, update, context }: onChangePayload<RealtimeContext>): Promise<void> {
    const buffer = this.buffer(documentName);
    buffer.document = document;
    buffer.updates.push(update);
    buffer.bytes += update.byteLength;
    if (context?.userId) buffer.actorId = context.userId;
    if (buffer.updates.length === 1) buffer.firstAt = Date.now();
    // Debounce, tetapi tidak melewati batas tunggu maksimum sejak update pertama.
    if (buffer.timer) clearTimeout(buffer.timer);
    const wait = Math.max(0, Math.min(this.debounceMs, buffer.firstAt + this.maxWaitMs - Date.now()));
    buffer.timer = setTimeout(() => {
      this.flush(documentName).catch((error: unknown) => {
        this.options.logger.error({ err: error, docId: documentName }, "flush dokumen gagal");
      });
    }, wait);
  }

  // Flush paksa: klien yang putus tidak boleh kehilangan perubahan yang masih di buffer.
  async onDisconnect({ documentName }: onDisconnectPayload<RealtimeContext>): Promise<void> {
    await this.flush(documentName);
  }

  async onDestroy(): Promise<void> {
    await Promise.all([...this.buffers.keys()].map((documentName) => this.flush(documentName)));
  }

  async afterUnloadDocument({ documentName }: { documentName: string }): Promise<void> {
    // Dokumen sudah di-destroy Hocuspocus; sisa buffer (bila ada) disimpan dengan estimasi ukuran.
    const buffer = this.buffers.get(documentName);
    if (buffer) buffer.document = null;
    await this.flush(documentName);
    this.buffers.delete(documentName);
  }

  /** Tulis buffer dokumen sebagai satu baris update (dipanggil timer, putus koneksi, shutdown). */
  flush(documentName: string): Promise<void> {
    const buffer = this.buffers.get(documentName);
    if (!buffer) return Promise.resolve();
    buffer.flushing = buffer.flushing.then(async () => {
      if (buffer.timer) clearTimeout(buffer.timer);
      buffer.timer = undefined;
      if (buffer.updates.length === 0) return;
      const updates = buffer.updates;
      const bytes = buffer.bytes;
      buffer.updates = [];
      buffer.bytes = 0;
      const merged = updates.length === 1 && updates[0] ? updates[0] : Y.mergeUpdates(updates);
      try {
        const stateBytes = buffer.document
          ? Y.encodeStateAsUpdate(buffer.document).byteLength
          : buffer.stateBytes + merged.byteLength;
        const { lastSeq } = await appendDocumentUpdates(
          this.options.db,
          systemScope("realtime: flush update dokumen"),
          documentName,
          [{ update: merged, origin: "local", actorId: buffer.actorId }],
          { sizeBytes: stateBytes },
        );
        buffer.stateBytes = stateBytes;
        this.options.logger.debug({ docId: documentName, lastSeq, merged: updates.length }, "update disimpan");
      } catch (error) {
        // Gagal simpan → kembalikan ke buffer (urutan tetap) agar dicoba lagi pada flush berikutnya.
        buffer.updates = [...updates, ...buffer.updates];
        buffer.bytes += bytes;
        throw error;
      }
    });
    return buffer.flushing;
  }

  private buffer(documentName: string): DocumentBuffer {
    let buffer = this.buffers.get(documentName);
    if (!buffer) {
      buffer = {
        updates: [],
        bytes: 0,
        actorId: null,
        firstAt: 0,
        stateBytes: 0,
        document: null,
        warned: false,
        flushing: Promise.resolve(),
      };
      this.buffers.set(documentName, buffer);
    }
    return buffer;
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
