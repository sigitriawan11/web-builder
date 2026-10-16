import { useCallback, useRef, useSyncExternalStore } from "react";
import type { UndoController } from "./undo-controller";

interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
}

const EMPTY: UndoState = { canUndo: false, canRedo: false };

/** ED-006: status tombol Undo/Redo toolbar mengikuti stack UndoManager. */
export function useUndoState(controller: UndoController | null): UndoState {
  const cache = useRef<UndoState>(EMPTY);
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!controller) return () => {};
      const { manager } = controller;
      const events = ["stack-item-added", "stack-item-popped", "stack-cleared"] as const;
      for (const event of events) manager.on(event, listener);
      return () => {
        for (const event of events) manager.off(event, listener);
      };
    },
    [controller],
  );
  const getSnapshot = useCallback(() => {
    const next = controller ? { canUndo: controller.canUndo(), canRedo: controller.canRedo() } : EMPTY;
    if (next.canUndo !== cache.current.canUndo || next.canRedo !== cache.current.canRedo) cache.current = next;
    return cache.current;
  }, [controller]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
