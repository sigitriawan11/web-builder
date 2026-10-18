import { createStore } from "zustand/vanilla";

// ED-045: antrean "stamp" image tool — file yang dipilih user menunggu ditaruh dengan klik di kanvas (urut klik).
// Ukuran natural dibaca saat penempatan (place) agar pemilihan tool & antre bersifat sinkron (tanpa menunggu decode).

export interface PendingImage {
  file: File;
}

interface ImageStampState {
  pending: readonly PendingImage[];
  setPending(items: readonly PendingImage[]): void;
  /** Ambil file berikutnya untuk ditaruh (menghapusnya dari antrean). */
  shift(): PendingImage | undefined;
  clear(): void;
}

export const imageStampStore = createStore<ImageStampState>()((set, get) => ({
  pending: [],
  setPending: (items) => set({ pending: items }),
  shift: () => {
    const [head, ...rest] = get().pending;
    if (!head) return undefined;
    set({ pending: rest });
    return head;
  },
  clear: () => set({ pending: [] }),
}));

const READ_TIMEOUT_MS = 3000;

/** Baca dimensi natural gambar dari File (object URL sementara). Gagal/timeout → 0×0 (penempatan pakai default). */
export function readImageSize(file: File): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let done = false;
    const finish = (size: { naturalWidth: number; naturalHeight: number }) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(size);
    };
    img.onload = () => finish({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    img.onerror = () => finish({ naturalWidth: 0, naturalHeight: 0 });
    // Jaring pengaman: beberapa lingkungan tidak memicu onload/onerror untuk blob → jangan menggantung penempatan.
    setTimeout(() => finish({ naturalWidth: 0, naturalHeight: 0 }), READ_TIMEOUT_MS);
    img.src = url;
  });
}
