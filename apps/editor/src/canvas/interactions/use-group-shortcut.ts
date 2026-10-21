import { groupNodes, runCommand, ungroup } from "@platform/document-model";
import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { selectionStore } from "../../store/selection-store";
import { showToast } from "../../store/toast-store";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-144/145: `Mod+G` mengelompokkan seleksi (parent sama) jadi group; `Mod+Shift+G` membongkar group/frame terpilih.
// Rect group = bounding box seleksi (lokal parent, dari geometry). Satu transaksi = satu undo.
export function useGroupShortcut(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || event.altKey || !(event.ctrlKey || event.metaKey) || event.code !== "KeyG") return;
      const ids = selectionStore.getState().selectedIds;
      if (ids.length === 0) return;
      event.preventDefault();
      if (runtime.isReadOnly()) return;

      if (event.shiftKey) {
        // Ungroup: tepat satu container terpilih.
        const id = ids[0];
        const node = id ? runtime.nodeStore.getNode(id) : null;
        if (ids.length !== 1 || !node || !("children" in node) || node.type === "page") return;
        runtime.undo.stopCapturing();
        const result = runCommand(runtime.commandCtx, ungroup, { id: node.id });
        runtime.undo.stopCapturing();
        if (result.ok) selectionStore.getState().select(result.affected.filter((a) => a !== node.parentId));
        return;
      }

      // Group: semua node harus punya parent yang sama.
      const parentId = runtime.nodeStore.getNode(ids[0] as string)?.parentId ?? null;
      if (!parentId) return;
      if (!ids.every((id) => runtime.nodeStore.getNode(id)?.parentId === parentId)) {
        showToast("sections.wrapSameParent", "warning");
        return;
      }
      const rects = ids
        .map((id) => runtime.geometry.store.peekRect(id))
        .filter((r): r is NonNullable<typeof r> => r != null);
      if (rects.length === 0) return;
      const x = Math.min(...rects.map((r) => r.x));
      const y = Math.min(...rects.map((r) => r.y));
      const width = Math.max(...rects.map((r) => r.x + r.width)) - x;
      const height = Math.max(...rects.map((r) => r.y + r.height)) - y;
      const parentRect = runtime.geometry.store.peekRect(parentId);
      const rect = { x: x - (parentRect?.x ?? 0), y: y - (parentRect?.y ?? 0), width, height };

      runtime.undo.stopCapturing();
      const result = runCommand(runtime.commandCtx, groupNodes, { ids: [...ids], rect });
      runtime.undo.stopCapturing();
      if (result.ok) selectionStore.getState().select([result.value]);
      else showToast("sections.wrapSameParent", "warning");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
