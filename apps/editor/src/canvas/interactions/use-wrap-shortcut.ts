import { resolveStyle, runCommand, wrapInFrame } from "@platform/document-model";
import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { selectionStore } from "../../store/selection-store";
import { showToast } from "../../store/toast-store";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-146: `Mod+Alt+G` membungkus seleksi dalam frame baru. Parent freeform → frame seukuran bounding box (rect dari
// geometry, lokal parent); parent auto-layout → frame Hug (tanpa rect). Parent berbeda → toast.
export function useWrapShortcut(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event)) return;
      if (!((event.ctrlKey || event.metaKey) && event.altKey && event.code === "KeyG")) return;
      const ids = selectionStore.getState().selectedIds;
      if (ids.length === 0) return;
      event.preventDefault();
      const parentId = runtime.nodeStore.getNode(ids[0] as string)?.parentId ?? null;
      if (!parentId) return;
      if (!ids.every((id) => runtime.nodeStore.getNode(id)?.parentId === parentId)) {
        showToast("sections.wrapSameParent", "warning");
        return;
      }
      const parent = runtime.nodeStore.getNode(parentId);
      const isFlex = parent ? resolveStyle(parent.style, "base").layout?.mode === "flex" : false;
      let rect: { x: number; y: number; width: number; height: number } | undefined;
      if (!isFlex) {
        const rects = ids
          .map((id) => runtime.geometry.store.peekRect(id))
          .filter((r): r is NonNullable<typeof r> => r != null);
        if (rects.length > 0) {
          const x = Math.min(...rects.map((r) => r.x));
          const y = Math.min(...rects.map((r) => r.y));
          const width = Math.max(...rects.map((r) => r.x + r.width)) - x;
          const height = Math.max(...rects.map((r) => r.y + r.height)) - y;
          const parentRect = runtime.geometry.store.peekRect(parentId);
          rect = { x: x - (parentRect?.x ?? 0), y: y - (parentRect?.y ?? 0), width, height };
        }
      }
      runtime.undo.stopCapturing();
      const result = runCommand({ doc: runtime.doc, origin: runtime.origin }, wrapInFrame, {
        ids: [...ids],
        ...(rect ? { rect } : {}),
      });
      runtime.undo.stopCapturing();
      if (result.ok) selectionStore.getState().select([result.value]);
      else showToast("sections.wrapSameParent", "warning");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
