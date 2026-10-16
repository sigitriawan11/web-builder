import type * as Y from "yjs";
import { hoverStore } from "./hover-store";
import { selectionStore } from "./selection-store";
import { textEditingStore } from "./text-editing-store";

/**
 * ED-061: setelah setiap transaksi dokumen (lokal, undo, AI, remote), ID UI yang nodenya sudah hilang dibuang dari
 * seleksi, hover, dan edit teks — UI tidak pernah menunjuk node yang tidak ada. Mengembalikan fungsi pelepas.
 */
export function syncUiWithDocument(doc: Y.Doc, exists: (id: string) => boolean): () => void {
  const onTransaction = () => {
    selectionStore.getState().prune(exists);
    const { hoveredId, setHovered } = hoverStore.getState();
    if (hoveredId !== null && !exists(hoveredId)) setHovered(null);
    const { editingId, stopEditing } = textEditingStore.getState();
    if (editingId !== null && !exists(editingId)) stopEditing();
  };
  doc.on("afterTransaction", onTransaction);
  return () => doc.off("afterTransaction", onTransaction);
}
