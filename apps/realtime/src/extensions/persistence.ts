import type {
  beforeHandleMessagePayload,
  Document,
  Extension,
  onChangePayload,
  onDisconnectPayload,
  onLoadDocumentPayload,
} from "@hocuspocus/server";
import { type Db, type DbExecutor, systemScope } from "@platform/db";
import {
  CURRENT_SCHEMA_VERSION,
  createJsonSnapshot,
  DOCUMENT_LIMITS,
  loadDocument,
  migrateYDoc,
  yDocToJson,
} from "@platform/document-model";
import type { RealtimeLimitWarningMessage, RealtimeSavedMessage } from "@platform/shared/contracts";
import type { Logger } from "@platform/shared/node";
import * as Y from "yjs";
import type { RealtimeContext } from "../auth";
import {
  appendDocumentUpdates,
  createDocumentSnapshot,
  loadStoredDocument,
  type SnapshotKind,
} from "../persistence/documents.repository";

// ARCHITECTURE §5.5/§7: persistence custom (append-only, bukan @hocuspocus/extension-database).
// Load (§7.3) = snapshot terbaru + update seq > upto_seq → migrasi schemaVersion bila perlu (origin `migration`).
// Tulis (§7.2) = update klien di-buffer per dokumen → flush (debounce, dengan batas tunggu maksimum) sebagai SATU
// baris `Y.mergeUpdates(buffer)` + `last_seq` dalam satu transaksi; flush paksa saat klien putus & saat shutdown.
// Snapshot (§7.2 langkah 3, DM-061) = state + JSON dari dokumen in-memory setelah flush, tiap ≥ N update atau ≥ interval.

export interface PersistenceOptions {
  db: Db;
  logger: Logger;
  // ARCHITECTURE §7.2: debounce 2 s, maksimum 10 s sejak update pertama di buffer.
  flushDebounceMs?: number;
  flushMaxWaitMs?: number;
  // DM-076/DM-061: batas ukuran state Yjs (default DOCUMENT_LIMITS.yDocStateBytes).
  stateLimits?: { soft: number; hard: number };
  // ARCHITECTURE §7.2: snapshot `auto` tiap ≥ 500 update atau ≥ 10 menit sejak snapshot terakhir.
  snapshotEveryUpdates?: number;
  snapshotIntervalMs?: number;
  // Jam untuk debounce/batas tunggu/interval snapshot (test menyuntik jam sendiri).
  now?: () => number;
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
  document: Document | null;
  warned: boolean;
  // Update klien (sebelum digabung) yang sudah tersimpan sejak snapshot terakhir.
  updatesSinceSnapshot: number;
  lastSnapshotAt: number;
  // Flush per dokumen berurutan agar seq tidak bertukar urutan.
  flushing: Promise<void>;
}

export class PersistenceExtension implements Extension {
  private readonly buffers = new Map<string, DocumentBuffer>();
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly limits: { soft: number; hard: number };
  private readonly snapshotEvery: number;
  private readonly snapshotIntervalMs: number;
  private readonly now: () => number;

  constructor(private readonly options: PersistenceOptions) {
    this.debounceMs = options.flushDebounceMs ?? 2000;
    this.maxWaitMs = options.flushMaxWaitMs ?? 10_000;
    this.limits = options.stateLimits ?? DOCUMENT_LIMITS.yDocStateBytes;
    this.snapshotEvery = options.snapshotEveryUpdates ?? 500;
    this.snapshotIntervalMs = options.snapshotIntervalMs ?? 10 * 60_000;
    this.now = options.now ?? Date.now;
  }

  async onLoadDocument({ documentName, document }: onLoadDocumentPayload<RealtimeContext>): Promise<void> {
    const tenant = systemScope("realtime: muat dokumen untuk koneksi terautentikasi");
    const stored = await loadStoredDocument(this.options.db, tenant, documentName);
    // Dokumen dibuat api bersama situs; tidak ada → koneksi gagal (bukan membuat dokumen kosong diam-diam).
    if (!stored) throw new Error(`dokumen ${documentName} tidak ditemukan`);

    const loaded = loadDocument(stored.snapshot?.state ?? null, stored.updates);
    const buffer = this.buffer(documentName);
    buffer.updatesSinceSnapshot = stored.updates.length;
    // Belum pernah di-snapshot → interval dihitung sejak dimuat.
    buffer.lastSnapshotAt = stored.snapshot?.createdAt.getTime() ?? this.now();
    try {
      if (stored.schemaVersion < CURRENT_SCHEMA_VERSION) {
        await this.migrate(documentName, loaded, stored.lastSeq);
        buffer.updatesSinceSnapshot = 0;
        buffer.lastSnapshotAt = this.now();
      }
      const state = Y.encodeStateAsUpdate(loaded);
      Y.applyUpdate(document, state);
      buffer.stateBytes = state.byteLength;
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
      const warning: RealtimeLimitWarningMessage = {
        type: "limit-warning",
        limit: "yDocStateBytes",
        bytes: estimate,
        max: this.limits.soft,
      };
      connection.sendStateless(JSON.stringify(warning));
    }
  }

  async onChange({ documentName, document, update, context }: onChangePayload<RealtimeContext>): Promise<void> {
    const buffer = this.buffer(documentName);
    buffer.document = document;
    buffer.updates.push(update);
    buffer.bytes += update.byteLength;
    if (context?.userId) buffer.actorId = context.userId;
    if (buffer.updates.length === 1) buffer.firstAt = this.now();
    // Debounce, tetapi tidak melewati batas tunggu maksimum sejak update pertama.
    if (buffer.timer) clearTimeout(buffer.timer);
    const wait = Math.max(0, Math.min(this.debounceMs, buffer.firstAt + this.maxWaitMs - this.now()));
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
      let savedSeq = 0;
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
        buffer.updatesSinceSnapshot += updates.length;
        this.options.logger.debug({ docId: documentName, lastSeq, merged: updates.length }, "update disimpan");
        savedSeq = lastSeq;
      } catch (error) {
        // Gagal simpan → kembalikan ke buffer (urutan tetap) agar dicoba lagi pada flush berikutnya.
        buffer.updates = [...updates, ...buffer.updates];
        buffer.bytes += bytes;
        throw error;
      }
      // ED-200: indikator "Tersimpan" — semua klien dokumen; masing-masing mencocokkan clock clientID-nya sendiri.
      if (buffer.document) {
        const clocks: RealtimeSavedMessage["clocks"] = {};
        // `parseUpdateMeta().to`, bukan `encodeStateVectorFromUpdate` (yang hanya memuat klien berawal dari clock 0).
        for (const [clientId, clock] of Y.parseUpdateMeta(merged).to) {
          clocks[String(clientId)] = clock;
        }
        const saved: RealtimeSavedMessage = { type: "saved", seq: savedSeq, clocks };
        buffer.document.broadcastStateless(JSON.stringify(saved));
      }
      // Snapshot gagal tidak membatalkan update yang sudah tersimpan; dicoba lagi pada flush berikutnya.
      const due =
        buffer.updatesSinceSnapshot >= this.snapshotEvery ||
        this.now() - buffer.lastSnapshotAt >= this.snapshotIntervalMs;
      if (due && buffer.document) {
        try {
          await this.snapshot(documentName, buffer.document, savedSeq, "auto", buffer.actorId);
          buffer.updatesSinceSnapshot = 0;
          buffer.lastSnapshotAt = this.now();
        } catch (error) {
          this.options.logger.error({ err: error, docId: documentName }, "snapshot otomatis gagal");
        }
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
        updatesSinceSnapshot: 0,
        lastSnapshotAt: this.now(),
        flushing: Promise.resolve(),
      };
      this.buffers.set(documentName, buffer);
    }
    return buffer;
  }

  // State + JSON dari dokumen in-memory. JSON tidak valid tetap disimpan (`json_invalid`) + alert, tidak memblokir
  // (AC DM-061); `uptoSeq` = seq terakhir yang sudah tersimpan saat snapshot diambil.
  private async snapshot(
    documentId: string,
    doc: Y.Doc,
    uptoSeq: number,
    kind: SnapshotKind,
    createdBy: string | null,
    db: DbExecutor = this.options.db,
  ): Promise<void> {
    const json = createJsonSnapshot(doc);
    if (json.invalid) {
      this.options.logger.error(
        { docId: documentId, kind, issues: json.issues.slice(0, 20) },
        "snapshot JSON tidak valid (tetap disimpan)",
      );
    }
    const created = await createDocumentSnapshot(db, systemScope("realtime: snapshot dokumen"), documentId, {
      uptoSeq,
      state: Y.encodeStateAsUpdate(doc),
      json: json.json,
      jsonInvalid: json.invalid,
      kind,
      createdBy,
    });
    this.options.logger.debug({ docId: documentId, snapshotId: created.id, kind, uptoSeq }, "snapshot dibuat");
  }

  // DM-071: migrasi saat load dalam SATU transaksi — snapshot `migration` sebelum (JSON versi lama, ditandai tidak
  // valid terhadap schema terkini tanpa alert), update ber-origin `migration` + schema_version, snapshot sesudah.
  // Disimpan langsung (tidak menunggu flush klien) agar tidak dijalankan ulang di load berikutnya.
  private async migrate(documentId: string, doc: Y.Doc, lastSeq: number): Promise<void> {
    const tenant = systemScope("realtime: simpan hasil migrasi schemaVersion");
    const beforeState = Y.encodeStateAsUpdate(doc);
    const beforeJson = yDocToJson(doc);
    const beforeVector = Y.encodeStateVector(doc);
    const result = migrateYDoc(doc);
    const update = Y.encodeStateAsUpdate(doc, beforeVector);
    await this.options.db.transaction(async (tx) => {
      if (result.applied.length > 0) {
        await createDocumentSnapshot(tx, tenant, documentId, {
          uptoSeq: lastSeq,
          state: beforeState,
          json: beforeJson,
          jsonInvalid: true,
          kind: "migration",
        });
      }
      const { lastSeq: migratedSeq } = await appendDocumentUpdates(
        tx,
        tenant,
        documentId,
        result.applied.length > 0 ? [{ update, origin: "migration" }] : [],
        { schemaVersion: result.toVersion },
      );
      if (result.applied.length > 0) await this.snapshot(documentId, doc, migratedSeq, "migration", null, tx);
    });
    this.options.logger.info(
      { docId: documentId, from: result.fromVersion, to: result.toVersion },
      "dokumen dimigrasi",
    );
  }
}
