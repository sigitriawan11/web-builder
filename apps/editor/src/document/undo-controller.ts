import { YDOC_KEYS } from "@platform/document-model";
import * as Y from "yjs";

// ED-197: kedalaman stack undo (memori); tidak dipersist antar sesi.
export const MAX_UNDO_STEPS = 200;
// ED-197 / DM-060: perubahan beruntun dalam jendela ini digabung menjadi satu langkah (ketikan, nudge).
export const CAPTURE_TIMEOUT_MS = 500;

const SELECTION_BEFORE = "selectionBefore";
const SELECTION_AFTER = "selectionAfter";

export interface SelectionAccess {
  get(): readonly string[];
  restore(ids: readonly string[]): void;
  // Node yang sudah tidak ada (mis. dihapus lalu undo item lain) disaring dari seleksi yang dipulihkan.
  exists(id: string): boolean;
}

export interface UndoController {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  // Batas antar aksi diskrit (commit drag/resize/reorder, paste): mencegah digabung oleh captureTimeout.
  stopCapturing(): void;
  readonly manager: Y.UndoManager;
  destroy(): void;
}

/**
 * Undo/redo dokumen (ED-197, DM-060): hanya origin lokal yang dilacak, sehingga perubahan `system`
 * (migrasi, repair) dan `remote` (kolaborator) tidak pernah di-undo. Setiap langkah menyimpan seleksi
 * sebelum & sesudah; undo memulihkan "sebelum", redo memulihkan "sesudah".
 */
export function createUndoController(doc: Y.Doc, localOrigin: unknown, selection: SelectionAccess): UndoController {
  const manager = new Y.UndoManager(
    [
      doc.getMap(YDOC_KEYS.nodes),
      doc.getArray(YDOC_KEYS.pageOrder),
      doc.getMap(YDOC_KEYS.meta),
      doc.getMap(YDOC_KEYS.assets),
    ],
    { trackedOrigins: new Set([localOrigin]), captureTimeout: CAPTURE_TIMEOUT_MS },
  );

  // Seleksi saat transaksi lokal dimulai = "sebelum" untuk langkah yang dibuat transaksi itu.
  let selectionAtTransactionStart: readonly string[] = [];
  const onBeforeTransaction = (transaction: Y.Transaction) => {
    if (transaction.origin === localOrigin) selectionAtTransactionStart = selection.get();
  };
  doc.on("beforeTransaction", onBeforeTransaction);

  // Item baru di stack lawan yang dibuat oleh undo/redo; meta-nya disalin dari item yang di-pop.
  let mirroredItem: { meta: Map<unknown, unknown> } | null = null;

  manager.on("stack-item-added", (event: { stackItem: { meta: Map<unknown, unknown> } }) => {
    if (manager.undoing || manager.redoing) {
      mirroredItem = event.stackItem;
      return;
    }
    event.stackItem.meta.set(SELECTION_BEFORE, selectionAtTransactionStart);
    event.stackItem.meta.set(SELECTION_AFTER, selection.get());
    // ED-197: batasi kedalaman stack.
    while (manager.undoStack.length > MAX_UNDO_STEPS) manager.undoStack.shift();
  });

  // Langkah yang tergabung (captureTimeout) mempertahankan "sebelum" dari aksi pertamanya.
  manager.on("stack-item-updated", (event: { stackItem: { meta: Map<unknown, unknown> } }) => {
    if (!manager.undoing && !manager.redoing) event.stackItem.meta.set(SELECTION_AFTER, selection.get());
  });

  manager.on("stack-item-popped", (event: { stackItem: { meta: Map<unknown, unknown> }; type: "undo" | "redo" }) => {
    const { meta } = event.stackItem;
    if (mirroredItem) {
      for (const [key, value] of meta) mirroredItem.meta.set(key, value);
      mirroredItem = null;
    }
    const ids = meta.get(event.type === "undo" ? SELECTION_BEFORE : SELECTION_AFTER);
    if (Array.isArray(ids)) selection.restore(ids.filter((id): id is string => typeof id === "string" && selection.exists(id)));
  });

  return {
    undo: () => {
      manager.undo();
    },
    redo: () => {
      manager.redo();
    },
    canUndo: () => manager.undoStack.length > 0,
    canRedo: () => manager.redoStack.length > 0,
    stopCapturing: () => manager.stopCapturing(),
    manager,
    destroy: () => {
      doc.off("beforeTransaction", onBeforeTransaction);
      manager.destroy();
    },
  };
}
