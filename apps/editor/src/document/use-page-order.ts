import { YDOC_KEYS } from "@platform/document-model";
import { useCallback, useRef, useSyncExternalStore } from "react";
import type * as Y from "yjs";

/** Urutan page dokumen (`pageOrder`, DM-005) — render ulang hanya saat array berubah. */
export function usePageOrder(doc: Y.Doc): readonly string[] {
  const array = doc.getArray<string>(YDOC_KEYS.pageOrder);
  const snapshot = useRef<readonly string[]>(array.toArray());
  const subscribe = useCallback(
    (listener: () => void) => {
      const handler = () => {
        snapshot.current = array.toArray();
        listener();
      };
      array.observe(handler);
      // State bisa sudah berubah antara render & subscribe (mis. IndexedDB/sync selesai).
      handler();
      return () => array.unobserve(handler);
    },
    [array],
  );
  const getSnapshot = useCallback(() => snapshot.current, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
