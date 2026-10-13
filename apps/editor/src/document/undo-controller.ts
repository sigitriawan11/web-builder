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
  // ED-115: sesi edit teks. Selama grup terbuka, langkah tetap granular (Ctrl+Z di editor teks);
  // `end()` menggabungkan semua langkah sejak `beginGroup` menjadi satu langkah undo.
  beginGroup(): { end(): void };
  readonly manager: Y.UndoManager;
  destroy(): void;
}

/**
 * Undo/redo dokumen (ED-197, DM-060): hanya origin lokal yang dilacak, sehingga perubahan `system`
 * (migrasi, repair) dan `remote` (kolaborator) tidak pernah di-undo. Setiap langkah menyimpan seleksi
 * sebelum & sesudah; undo memulihkan "sebelum", redo memulihkan "sesudah".
 * `localOrigins`: semua origin milik user ini — command canvas dan binding teks Tiptap (`ySyncPluginKey`),
 * sehingga ketikan dan aksi canvas berbagi satu stack undo.
 */
export function createUndoController(
  doc: Y.Doc,
  localOrigins: readonly unknown[],
  selection: SelectionAccess,
): UndoController {
  const tracked = new Set(localOrigins);
  const manager = new Y.UndoManager(
    [
      doc.getMap(YDOC_KEYS.nodes),
      doc.getArray(YDOC_KEYS.pageOrder),
      doc.getMap(YDOC_KEYS.meta),
      doc.getMap(YDOC_KEYS.assets),
    ],
    { trackedOrigins: tracked, captureTimeout: CAPTURE_TIMEOUT_MS },
  );

  // Seleksi saat transaksi lokal dimulai = "sebelum" untuk langkah yang dibuat transaksi itu.
  let selectionAtTransactionStart: readonly string[] = [];
  const onBeforeTransaction = (transaction: Y.Transaction) => {
    if (tracked.has(transaction.origin)) selectionAtTransactionStart = selection.get();
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

  // Langkah yang tergabung (captureTimeout) mempertahankan "sebelum" dari aksi pertamanya. Yjs hanya
  // menggabungkan di luar undo/redo, jadi event ini selalu berasal dari perubahan lokal biasa.
  manager.on("stack-item-updated", (event: { stackItem: { meta: Map<unknown, unknown> } }) => {
    event.stackItem.meta.set(SELECTION_AFTER, selection.get());
  });

  manager.on("stack-item-popped", (event: { stackItem: { meta: Map<unknown, unknown> }; type: "undo" | "redo" }) => {
    const { meta } = event.stackItem;
    // Pengaman: Yjs hanya memancarkan "popped" bila undo/redo mengubah sesuatu, dan perubahan itu selalu
    // menambah item cermin ber-meta di stack lawan (penggabungan dimatikan saat undo/redo). Kedua cabang
    // "tidak ada" di bawah tidak bisa dicapai lewat API UndoManager; dipertahankan bila perilaku Yjs berubah.
    /* v8 ignore next 4 */
    if (mirroredItem) {
      for (const [key, value] of meta) mirroredItem.meta.set(key, value);
      mirroredItem = null;
    }
    const ids = meta.get(event.type === "undo" ? SELECTION_BEFORE : SELECTION_AFTER);
    /* v8 ignore next */
    if (Array.isArray(ids))
      selection.restore(ids.filter((id): id is string => typeof id === "string" && selection.exists(id)));
  });

  type Item = (typeof manager.undoStack)[number];
  const beginGroup = () => {
    manager.stopCapturing();
    const before = new Set<Item>(manager.undoStack);
    return {
      end: () => {
        manager.stopCapturing();
        const stack = manager.undoStack;
        // Langkah grup = ekor stack yang belum ada saat grup dibuka (undo melewati awal grup → tidak ada).
        let start = stack.length;
        while (start > 0 && !before.has(stack[start - 1] as Item)) start--;
        const items = stack.slice(start);
        const [first, ...rest] = items;
        const last = items.at(-1);
        if (!first || !last || rest.length === 0) return;
        // Sama dengan cara Yjs menggabungkan langkah dalam captureTimeout.
        first.insertions = Y.mergeDeleteSets(items.map((item) => item.insertions));
        first.deletions = Y.mergeDeleteSets(items.map((item) => item.deletions));
        first.meta.set(SELECTION_AFTER, last.meta.get(SELECTION_AFTER));
        stack.splice(start + 1);
      },
    };
  };

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
    beginGroup,
    manager,
    destroy: () => {
      doc.off("beforeTransaction", onBeforeTransaction);
      manager.destroy();
    },
  };
}
