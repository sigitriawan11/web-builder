import { type Breakpoint, BreakpointDefSchema, YDOC_KEYS } from "@platform/document-model";
import { useCallback, useRef, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import { DEFAULT_PREVIEW_WIDTHS } from "../canvas/frames/frame-layout";

type Widths = Readonly<Record<Breakpoint, number>>;

/** Lebar preview per breakpoint dari `settings.breakpoints` (DM-035); data rusak → default. */
export function readPreviewWidths(doc: Y.Doc): Widths {
  const raw = doc.getMap<unknown>(YDOC_KEYS.settings).get("breakpoints");
  const parsed = BreakpointDefSchema.array().safeParse(raw);
  if (!parsed.success) return DEFAULT_PREVIEW_WIDTHS;
  const widths = { ...DEFAULT_PREVIEW_WIDTHS };
  for (const breakpoint of parsed.data) widths[breakpoint.id] = breakpoint.previewWidth;
  return widths;
}

export function usePreviewWidths(doc: Y.Doc): Widths {
  const cache = useRef<{ key: string; widths: Widths } | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => {
      const settings = doc.getMap(YDOC_KEYS.settings);
      settings.observe(listener);
      return () => settings.unobserve(listener);
    },
    [doc],
  );
  const getSnapshot = useCallback(() => {
    const widths = readPreviewWidths(doc);
    const key = `${widths.base}/${widths.tablet}/${widths.mobile}`;
    if (cache.current?.key !== key) cache.current = { key, widths };
    return cache.current.widths;
  }, [doc]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
