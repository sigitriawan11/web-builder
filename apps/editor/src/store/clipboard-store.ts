import { createStore } from "zustand/vanilla";

// UI state clipboard internal (Epic 2.14, ED-181): metadata salinan terakhir untuk paste di dalam editor & "paste
// in place". Isi salinan = subtree JSON terserialisasi (string, `@platform/document-model` SubtreeSchema divalidasi
// saat paste) — bukan bagian dokumen hidup; dokumen tetap hanya di Y.Doc.
export interface ClipboardEntry {
  // Subtree JSON (string) — divalidasi ulang saat paste, karena bisa berasal dari tab/situs lain.
  payload: string;
  // Asal salinan: paste ke situs lain memerlukan penanganan aset/token (Epic 2.14).
  sourceSiteId: string;
  // Posisi world asal (paste in place / offset +10 px).
  origin: { x: number; y: number } | null;
  copiedAt: number;
}

interface ClipboardState {
  entry: ClipboardEntry | null;
  // Berapa kali entry ini sudah di-paste (offset bertingkat).
  pasteCount: number;
  set(entry: ClipboardEntry): void;
  notePaste(): void;
  clear(): void;
}

export const clipboardStore = createStore<ClipboardState>()((set, get) => ({
  entry: null,
  pasteCount: 0,
  set: (entry) => set({ entry, pasteCount: 0 }),
  notePaste: () => set({ pasteCount: get().pasteCount + 1 }),
  clear: () => set({ entry: null, pasteCount: 0 }),
}));
