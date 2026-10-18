import { createStore } from "zustand/vanilla";

// ED-031: UI state pencarian layer (Mod+F). Bukan bagian dokumen.
interface LayerSearchState {
  open: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
}

export const layerSearchStore = createStore<LayerSearchState>()((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}));
