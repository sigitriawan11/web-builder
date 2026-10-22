import { createStore } from "zustand/vanilla";

// ED-058 / T3.6.3: seleksi "di dalam instance". Terpisah dari `selectionStore` (yang hanya memuat node dokumen):
// resolved child bukan node dokumen, jadi diidentifikasi oleh (instanceId, path definisi) + id resolved untuk overlay.
// `path` = ID node definisi (satu segmen; nested/repeater = M4). Override ditulis ke `instance.props.overrides[path]`.
export interface ChildSelection {
  instanceId: string;
  path: string;
  resolvedId: string;
}

interface ChildSelectionState {
  selection: ChildSelection | null;
  select(selection: ChildSelection): void;
  clear(): void;
}

export const childSelectionStore = createStore<ChildSelectionState>()((set, get) => ({
  selection: null,
  select: (selection) => set({ selection }),
  clear: () => {
    if (get().selection !== null) set({ selection: null });
  },
}));
