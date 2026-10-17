import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { nodeLinkStore } from "../../store/node-link-store";
import { selectionStore } from "../../store/selection-store";
import { textEditingStore } from "../../store/text-editing-store";
import type { CanvasRuntime } from "../canvas-runtime";

const LINKABLE = new Set(["frame", "image", "shape", "icon"]);

// ED-181: Mod+K saat satu node (frame/image/shape/icon) terseleksi dan TIDAK sedang edit teks → buka editor tautan
// node. (Mod+Shift+K = tool Image; Mod+K di dalam teks = tautan inline Tiptap, ditangani editor teks.)
export function useNodeLinkShortcut(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyK" || event.shiftKey || !(event.metaKey || event.ctrlKey)) return;
      if (isEditableEvent(event) || textEditingStore.getState().editingId !== null) return;
      const ids = selectionStore.getState().selectedIds;
      if (ids.length !== 1) return;
      const id = ids[0];
      if (id === undefined) return;
      const node = runtime.nodeStore.getNode(id);
      if (!node || !LINKABLE.has(node.type)) return;
      event.preventDefault();
      nodeLinkStore.getState().requestOpen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
