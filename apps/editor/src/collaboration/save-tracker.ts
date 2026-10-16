import { RealtimeStatelessMessageSchema } from "@platform/shared/contracts";
import * as Y from "yjs";

// ED-200: status autosave. "Tersimpan" hanya bila server mengonfirmasi lewat stateless `saved` yang clock clientID
// tab ini ≥ clock lokal — update yang masih di jalan tidak ikut dianggap tersimpan.

export type SaveStatus = "saved" | "saving" | "offline" | "error";

// "Menyimpan…" baru tampil bila update tertunda lebih lama dari ini (ketikan cepat tidak berkedip).
export const SAVING_DELAY_MS = 500;
// Masih tertunda selama ini padahal online → "Gagal menyimpan — mencoba lagi".
export const SAVE_ERROR_AFTER_MS = 15_000;

export interface SaveTrackerTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface SaveTracker {
  status(): SaveStatus;
  /** Ada perubahan lokal yang belum dikonfirmasi server (dasar peringatan `beforeunload`). */
  hasUnsaved(): boolean;
  subscribe(listener: () => void): () => void;
  /** Payload stateless dari provider (pesan selain `saved` diabaikan). */
  handleStateless(payload: string): void;
  setOnline(online: boolean): void;
  destroy(): void;
}

const defaultTimers: SaveTrackerTimers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createSaveTracker(doc: Y.Doc, timers: SaveTrackerTimers = defaultTimers): SaveTracker {
  const listeners = new Set<() => void>();
  // Hanya transaksi lokal yang menaikkan clock clientID doc ini; update remote/IndexedDB tidak.
  const localClock = () => Y.getState(doc.store, doc.clientID);
  let savedClock = localClock();
  let online = false;
  let delayed: "none" | "saving" | "error" = "none";
  let savingTimer: unknown = null;
  let errorTimer: unknown = null;
  let current: SaveStatus = "offline";

  const pending = () => localClock() > savedClock;
  const clearTimers = () => {
    if (savingTimer !== null) timers.clearTimeout(savingTimer);
    if (errorTimer !== null) timers.clearTimeout(errorTimer);
    savingTimer = errorTimer = null;
    delayed = "none";
  };
  const compute = (): SaveStatus => {
    if (!online) return "offline";
    if (!pending()) return "saved";
    return delayed === "error" ? "error" : delayed === "saving" ? "saving" : "saved";
  };
  const refresh = () => {
    const next = compute();
    if (next === current) return;
    current = next;
    for (const listener of listeners) listener();
  };
  const schedule = () => {
    if (!pending()) {
      clearTimers();
      return;
    }
    savingTimer ??= timers.setTimeout(() => {
      delayed = "saving";
      refresh();
    }, SAVING_DELAY_MS);
    errorTimer ??= timers.setTimeout(() => {
      delayed = "error";
      refresh();
    }, SAVE_ERROR_AFTER_MS);
  };

  const onUpdate = () => {
    schedule();
    refresh();
  };
  doc.on("update", onUpdate);

  return {
    status: () => current,
    hasUnsaved: pending,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    handleStateless(payload) {
      let json: unknown;
      try {
        json = JSON.parse(payload);
      } catch {
        return;
      }
      const message = RealtimeStatelessMessageSchema.safeParse(json);
      if (!message.success || message.data.type !== "saved") return;
      const clock = message.data.clocks[String(doc.clientID)];
      if (clock !== undefined && clock > savedClock) savedClock = clock;
      if (!pending()) clearTimers();
      refresh();
    },
    setOnline(next) {
      online = next;
      // Kembali online: hitung ulang jendela "menyimpan"/"gagal" dari awal.
      clearTimers();
      if (online) schedule();
      refresh();
    },
    destroy() {
      doc.off("update", onUpdate);
      clearTimers();
      listeners.clear();
    },
  };
}
