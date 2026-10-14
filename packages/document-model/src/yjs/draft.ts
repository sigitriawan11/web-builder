import * as Y from "yjs";
import { aiOrigin } from "./origin";

// DM-060 / spec 04 §7: AI bekerja di fork Y.Doc per run (draft). "Terapkan" = seluruh perubahan draft masuk dokumen
// utama dalam SATU transaksi ber-origin AI → satu langkah undo ("Batalkan perubahan AI" = undo sekali).

export interface DocumentFork {
  draft: Y.Doc;
  // State vector dokumen utama saat fork — draft update = semua yang ditulis setelah titik ini.
  base: Uint8Array;
}

export function forkDocument(doc: Y.Doc): DocumentFork {
  const draft = new Y.Doc();
  Y.applyUpdate(draft, Y.encodeStateAsUpdate(doc));
  return { draft, base: Y.encodeStateVector(doc) };
}

/** Update biner berisi semua perubahan di draft sejak fork (untuk dikirim/disimpan sebagai hasil run). */
export function draftUpdate(fork: DocumentFork): Uint8Array {
  return Y.encodeStateAsUpdate(fork.draft, fork.base);
}

/**
 * Terapkan update draft run AI ke dokumen utama sebagai satu langkah undo. `stopCapturing` sebelum & sesudah
 * mencegah langkah AI tergabung dengan edit user yang berdekatan (captureTimeout).
 */
/** Terapkan update draft sebagai satu transaksi ber-`origin` (dipakai `runCommands` & `applyDraft`). */
export function applyDraftUpdate(doc: Y.Doc, update: Uint8Array, origin: unknown): void {
  Y.applyUpdate(doc, update, origin);
}

export function applyDraft(
  doc: Y.Doc,
  update: Uint8Array,
  runId: string,
  undoManager?: Pick<Y.UndoManager, "stopCapturing" | "addTrackedOrigin">,
): void {
  const origin = aiOrigin(runId);
  undoManager?.addTrackedOrigin(origin);
  undoManager?.stopCapturing();
  applyDraftUpdate(doc, update, origin);
  undoManager?.stopCapturing();
}
