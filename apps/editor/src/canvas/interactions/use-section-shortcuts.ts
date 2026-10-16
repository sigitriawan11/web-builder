import { reorderNode, runCommand } from "@platform/document-model";
import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { selectionStore } from "../../store/selection-store";
import { showToast } from "../../store/toast-store";
import type { CanvasRuntime } from "../canvas-runtime";
import { type ZOrderOp, zOrderIndex } from "../section-order";

// ED-036/091: `Mod+]`/`Mod+[` majukan/mundurkan satu posisi (z-order); `Mod+Alt+]`/`Mod+Alt+[` ke paling
// depan/belakang. Urutan DOM = stacking. `Delete`/`Backspace` pada page root → toast (hapus lewat Pages panel).
export function useSectionShortcuts(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event)) return;
      const ids = selectionStore.getState().selectedIds;
      const mod = event.ctrlKey || event.metaKey;

      if (mod && !event.shiftKey && (event.code === "BracketRight" || event.code === "BracketLeft")) {
        if (ids.length !== 1) return;
        const id = ids[0] as string;
        const node = runtime.nodeStore.getNode(id);
        const parent = node?.parentId ? runtime.nodeStore.getNode(node.parentId) : null;
        if (!node || !parent || !("children" in parent)) return;
        const forward = event.code === "BracketRight";
        const op: ZOrderOp = event.altKey ? (forward ? "front" : "back") : forward ? "forward" : "backward";
        const to = zOrderIndex(parent.children.length, parent.children.indexOf(id), op);
        if (to === null) return;
        event.preventDefault();
        runtime.undo.stopCapturing();
        runCommand({ doc: runtime.doc, origin: runtime.origin }, reorderNode, { id, index: to });
        return;
      }

      if (event.code === "Delete" || event.code === "Backspace") {
        // AC ED-036: Delete pada page root tidak melakukan apa-apa (hapus page lewat Pages panel).
        if (ids.length === 1 && runtime.nodeStore.getNode(ids[0] as string)?.type === "page") {
          event.preventDefault();
          showToast("sections.pageNotDeletable", "warning");
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
