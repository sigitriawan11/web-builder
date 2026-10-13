import { createStore } from "zustand/vanilla";

// UI state (bukan dokumen): node teks yang sedang diedit inline (ED-115).
interface TextEditingState {
  editingId: string | null;
  startEditing(id: string): void;
  stopEditing(): void;
}

export const textEditingStore = createStore<TextEditingState>()((set) => ({
  editingId: null,
  startEditing: (id) => set({ editingId: id }),
  stopEditing: () => set({ editingId: null }),
}));
