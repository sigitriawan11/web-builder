import { type Theme, ThemeSchema, YDOC_KEYS } from "@platform/document-model";
import { useCallback, useRef, useSyncExternalStore } from "react";
import type * as Y from "yjs";

/** Theme dokumen (token & font) dari Y.Doc; snapshot baru hanya saat map theme berubah. */
export function readDocTheme(doc: Y.Doc): Theme | null {
  // Y.Doc bisa berisi update remote → divalidasi di boundary (seperti NodeStore).
  const parsed = ThemeSchema.safeParse(doc.getMap(YDOC_KEYS.theme).toJSON());
  return parsed.success ? parsed.data : null;
}

export function useDocTheme(doc: Y.Doc): Theme | null {
  const cache = useRef<{ doc: Y.Doc; theme: Theme | null } | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => {
      const map = doc.getMap(YDOC_KEYS.theme);
      const handler = () => {
        cache.current = null;
        listener();
      };
      map.observeDeep(handler);
      return () => map.unobserveDeep(handler);
    },
    [doc],
  );
  const getSnapshot = useCallback(() => {
    if (cache.current?.doc !== doc) cache.current = { doc, theme: readDocTheme(doc) };
    return cache.current.theme;
  }, [doc]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
