import { createStore } from "zustand/vanilla";

// UI state: rect yang sedang digambar tool pembuat node (ED-037), dalam koordinat world. Null = tidak menggambar.
export interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawState {
  rect: DrawRect | null;
  set(rect: DrawRect | null): void;
}

export const drawStore = createStore<DrawState>()((set) => ({
  rect: null,
  set: (rect) => set({ rect }),
}));
