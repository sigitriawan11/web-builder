import type { StylePatch } from "@platform/document-model";
import { createStore } from "zustand/vanilla";

// ED-024: override style SEMENTARA selama drag (mis. resize di auto-layout perlu reflow nyata).
// Dibaca renderer di atas style dokumen; tidak pernah masuk Yjs sampai commit.
interface PreviewState {
  styles: Readonly<Record<string, StylePatch>>;
  setStyle(id: string, patch: StylePatch): void;
  clear(ids: readonly string[]): void;
}

export const previewStore = createStore<PreviewState>()((set, get) => ({
  styles: {},
  setStyle: (id, patch) => set({ styles: { ...get().styles, [id]: patch } }),
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
