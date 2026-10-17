import { createStore } from "zustand/vanilla";

// ED-204: UI state command palette (bukan dokumen). Dibuka lewat Mod+/ (selalu) atau Mod+K (tanpa seleksi).
interface PaletteState {
  open: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
}

export const paletteStore = createStore<PaletteState>()((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}));
