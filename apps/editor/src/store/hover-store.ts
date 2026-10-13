import { createStore } from "zustand/vanilla";

// UI state: node yang akan terpilih bila diklik (outline hover, ED-038).
interface HoverState {
  hoveredId: string | null;
  setHovered(id: string | null): void;
}

export const hoverStore = createStore<HoverState>()((set, get) => ({
  hoveredId: null,
  setHovered: (id) => {
    if (get().hoveredId !== id) set({ hoveredId: id });
  },
}));
