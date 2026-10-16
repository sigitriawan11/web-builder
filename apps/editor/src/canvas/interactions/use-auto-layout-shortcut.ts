import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { selectionStore } from "../../store/selection-store";
import { removeAutoLayoutFromSelection, toggleAutoLayout } from "../auto-layout/apply";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-079: Shift+A menambah/membungkus auto-layout; Shift+Alt+A menghapusnya. Pakai event.code "KeyA".
export function useAutoLayoutShortcut(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || event.ctrlKey || event.metaKey) return;
      if (!event.shiftKey || event.code !== "KeyA") return;
      const ids = selectionStore.getState().selectedIds;
      if (ids.length === 0) return;
      event.preventDefault();
      if (event.altKey) removeAutoLayoutFromSelection(runtime, ids);
      else toggleAutoLayout(runtime, ids);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
