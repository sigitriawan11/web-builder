import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { selectAllInContext } from "../../commands/selection-nav";
import { selectionStore } from "../../store/selection-store";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-056: `Mod+A` memilih semua sibling dalam konteks seleksi (anak dari parent node terseleksi; tanpa seleksi =
// semua section page root). Saat mengetik dibiarkan ke browser (= pilih semua teks di node).
export function useSelectAll(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event)) return;
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      if (event.key !== "a" && event.key !== "A") return;

      const ids = selectAllInContext(selectionStore.getState().selectedIds, runtime.nodeStore.getNode, runtime.pageId);
      if (ids.length === 0) return;
      event.preventDefault();
      selectionStore.getState().select(ids);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
