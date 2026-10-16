import { CURRENT_SCHEMA_VERSION, YDOC_KEYS } from "@platform/document-model";
import { useCallback, useSyncExternalStore } from "react";
import type * as Y from "yjs";

// ED-230: versi skema dokumen di Y.Doc (`meta.schemaVersion`). Dokumen lama dimigrasi server saat load (DM-071,
// origin system) dan hasilnya tiba lewat sync; dokumen yang LEBIH BARU dari editor ini tidak boleh diedit.

export function documentSchemaVersion(doc: Y.Doc): number | null {
  const value = doc.getMap<unknown>(YDOC_KEYS.meta).get("schemaVersion");
  return typeof value === "number" ? value : null;
}

export function useDocumentSchemaVersion(doc: Y.Doc): number | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      const meta = doc.getMap<unknown>(YDOC_KEYS.meta);
      meta.observe(listener);
      return () => meta.unobserve(listener);
    },
    [doc],
  );
  const read = useCallback(() => documentSchemaVersion(doc), [doc]);
  return useSyncExternalStore(subscribe, read, read);
}

export const isNewerThanEditor = (version: number | null) => version !== null && version > CURRENT_SCHEMA_VERSION;

// Satu kali muat ulang otomatis per versi (aset editor `index.html` no-cache → bundle terbaru); bila setelah itu
// dokumen masih lebih baru, layar "perlu diperbarui" — tidak ada loop reload.
const RELOAD_KEY = "platform.schemaReload";

export interface ReloadStorage {
  get(): string | null;
  set(value: string): void;
}

const sessionReloadStorage: ReloadStorage = {
  get: () => {
    try {
      return sessionStorage.getItem(RELOAD_KEY);
    } catch {
      return null;
    }
  },
  set: (value) => {
    try {
      sessionStorage.setItem(RELOAD_KEY, value);
    } catch {
      // Tanpa sessionStorage: tidak reload otomatis (lebih aman daripada loop); layar tetap menawarkan muat ulang.
    }
  },
};

/** true bila reload otomatis dipicu sekarang; false bila sudah pernah untuk versi ini (tampilkan layar). */
export function reloadOnceForSchema(
  version: number,
  reload: () => void,
  storage: ReloadStorage = sessionReloadStorage,
): boolean {
  if (storage.get() === String(version)) return false;
  storage.set(String(version));
  if (storage.get() !== String(version)) return false;
  reload();
  return true;
}
