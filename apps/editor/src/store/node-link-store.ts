import { createStore } from "zustand/vanilla";

// ED-181: UI state (bukan dokumen) — permintaan membuka editor tautan node (lewat Mod+K). `requestId` naik tiap
// permintaan agar LinkSection membuka popover-nya meski node yang sama diminta dua kali.
interface NodeLinkState {
  requestId: number;
  requestOpen(): void;
}

export const nodeLinkStore = createStore<NodeLinkState>()((set, get) => ({
  requestId: 0,
  requestOpen: () => set({ requestId: get().requestId + 1 }),
}));
