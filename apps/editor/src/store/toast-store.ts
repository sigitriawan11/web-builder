import type { MessageKey } from "@platform/i18n";
import { createStore } from "zustand/vanilla";

// UI state: toast ringan sementara (ED-036 page tidak bisa dihapus, ED-070 clamp, ED-228 error command). Menyimpan
// KUNCI pesan (namespace editor) agar teks mengikuti bahasa UI saat dirender, ATAU teks terlokalisasi {id,en} (mis.
// pesan error command). Bukan dokumen.
export type ToastKind = "info" | "warning" | "error";
export type LocalizedText = { id: string; en: string };

interface BaseToast {
  id: number;
  kind: ToastKind;
}
export type Toast =
  | (BaseToast & { messageKey: MessageKey<"editor">; text?: undefined })
  | (BaseToast & { text: LocalizedText; messageKey?: undefined });

interface ToastState {
  toasts: readonly Toast[];
  show(messageKey: MessageKey<"editor">, kind?: ToastKind): number;
  showText(text: LocalizedText, kind?: ToastKind): number;
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
  showText: (text, kind = "error") => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, text, kind }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const showToast = (messageKey: MessageKey<"editor">, kind?: ToastKind) =>
  toastStore.getState().show(messageKey, kind);

/** ED-228: tampilkan pesan error command (sudah terlokalisasi {id,en}) sebagai toast error. */
export const showToastText = (text: LocalizedText, kind: ToastKind = "error") =>
  toastStore.getState().showText(text, kind);
