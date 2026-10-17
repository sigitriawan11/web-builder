import { createStore } from "zustand/vanilla";

// ED-004/ED-207: state mode preview (overlay full-screen di dalam editor). Terpisah dari `preview-store` (override
// style saat drag). Seleksi & kamera tidak disentuh (tetap saat masuk/keluar preview).
interface PreviewModeState {
  open: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
}

export const previewModeStore = createStore<PreviewModeState>()((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}));
