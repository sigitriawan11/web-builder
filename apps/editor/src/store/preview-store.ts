import type { StylePatch } from "@platform/document-model";
import { createStore } from "zustand/vanilla";

// ED-024: override style SEMENTARA selama drag (mis. resize di auto-layout perlu reflow nyata).
// Dibaca renderer di atas style dokumen; tidak pernah masuk Yjs sampai commit.
interface PreviewState {
  styles: Readonly<Record<string, StylePatch>>;
  // Geser sementara (px world) node yang sedang dipindah; elemennya digeser lewat `translate`,
  // overlay seleksi membaca nilai ini agar kotak seleksi ikut bergeser.
  offset: { ids: readonly string[]; dx: number; dy: number } | null;
  setStyle(id: string, patch: StylePatch): void;
  setOffset(offset: PreviewState["offset"]): void;
  clear(ids: readonly string[]): void;
}

export const previewStore = createStore<PreviewState>()((set, get) => ({
  styles: {},
  offset: null,
  setStyle: (id, patch) => set({ styles: { ...get().styles, [id]: patch } }),
  setOffset: (offset) => set({ offset }),
  clear: (ids) => {
    const styles = { ...get().styles };
    let changed = false;
    for (const id of ids) {
      if (id in styles) {
        delete styles[id];
        changed = true;
      }
    }
    if (changed) set({ styles });
  },
}));
