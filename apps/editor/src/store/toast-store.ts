import type { MessageKey } from "@platform/i18n";
import { createStore } from "zustand/vanilla";

// UI state: toast ringan sementara (ED-036 page tidak bisa dihapus, ED-070 clamp, dll). Menyimpan KUNCI pesan
// (namespace editor) agar teks mengikuti bahasa UI saat dirender; bukan dokumen.
export interface Toast {
  id: number;
  messageKey: MessageKey<"editor">;
  kind: "info" | "warning";
}

interface ToastState {
  toasts: readonly Toast[];
  show(messageKey: MessageKey<"editor">, kind?: Toast["kind"]): number;
  dismiss(id: number): void;
}

// Counter monotonic untuk key React (bukan Math.random/Date — deterministik di test).
let nextId = 1;

export const toastStore = createStore<ToastState>()((set) => ({
  toasts: [],
  show: (messageKey, kind = "info") => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, messageKey, kind }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const showToast = (messageKey: MessageKey<"editor">, kind?: Toast["kind"]) =>
  toastStore.getState().show(messageKey, kind);
