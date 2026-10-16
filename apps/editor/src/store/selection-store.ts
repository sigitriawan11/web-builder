import { createStore } from "zustand/vanilla";

// UI state (bukan dokumen, DM-001 / ED-061): node yang terseleksi. Canvas, layers, inspector, dan AI panel membaca
// store yang sama; tidak pernah disimpan di Yjs.
interface SelectionState {
  selectedIds: readonly string[];
  // Titik acuan seleksi (Shift+klik rentang di layers, M2): node terakhir yang dipilih secara eksplisit.
  anchorId: string | null;
  select(ids: readonly string[]): void;
  clear(): void;
  // ED-061: buang ID yang sudah tidak ada di dokumen (dihapus oleh undo, AI, atau kolaborator).
  prune(exists: (id: string) => boolean): void;
}

const EMPTY: readonly string[] = [];

export const selectionStore = createStore<SelectionState>()((set, get) => ({
  selectedIds: EMPTY,
  anchorId: null,
  select: (ids) => {
    const current = get().selectedIds;
    // Referensi tetap bila isinya sama, agar subscriber tidak render ulang.
    if (ids.length === current.length && ids.every((id, index) => id === current[index])) return;
    set({ selectedIds: ids.length === 0 ? EMPTY : [...ids], anchorId: ids.at(-1) ?? null });
  },
  clear: () => {
    if (get().selectedIds.length > 0) set({ selectedIds: EMPTY, anchorId: null });
  },
  prune: (exists) => {
    const { selectedIds, anchorId } = get();
    const kept = selectedIds.filter(exists);
    if (kept.length === selectedIds.length) return;
    set({
      selectedIds: kept.length === 0 ? EMPTY : kept,
      anchorId: anchorId !== null && exists(anchorId) ? anchorId : (kept.at(-1) ?? null),
    });
  },
}));
