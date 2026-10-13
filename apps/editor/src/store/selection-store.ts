import { createStore } from "zustand/vanilla";

// UI state (bukan dokumen, DM-001): node yang terseleksi di canvas.
interface SelectionState {
  selectedIds: readonly string[];
  select(ids: readonly string[]): void;
  clear(): void;
}

const EMPTY: readonly string[] = [];

export const selectionStore = createStore<SelectionState>()((set, get) => ({
  selectedIds: EMPTY,
  select: (ids) => {
    const current = get().selectedIds;
    // Referensi tetap bila isinya sama, agar subscriber tidak render ulang.
    if (ids.length === current.length && ids.every((id, index) => id === current[index])) return;
    set({ selectedIds: ids.length === 0 ? EMPTY : [...ids] });
  },
  clear: () => {
    if (get().selectedIds.length > 0) set({ selectedIds: EMPTY });
  },
}));
