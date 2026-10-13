import { type RefObject, useEffect } from "react";
import type { NodeStore } from "../../document/node-store";
import { textEditingStore } from "../../store/text-editing-store";

// Elemen node terdalam di jalur event. composedPath menembus shadow root (Opsi A), event.target tidak.
function nodeIdInPath(event: Event): string | null {
  for (const target of event.composedPath()) {
    if (target instanceof HTMLElement && target.dataset.nodeId) return target.dataset.nodeId;
  }
  return null;
}

// ED-115 (spike): double-click node teks → edit inline; klik di luar node itu → selesai.
export function useTextEditingInteractions(viewportRef: RefObject<HTMLElement | null>, nodeStore: NodeStore): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { startEditing, stopEditing } = textEditingStore.getState();

    const onDoubleClick = (event: MouseEvent) => {
      const id = nodeIdInPath(event);
      // Double-click di dalam teks yang sedang diedit = pilih kata (ditangani ProseMirror).
      if (!id || id === textEditingStore.getState().editingId) return;
      if (nodeStore.getNode(id)?.type === "text") startEditing(id);
    };

    const onPointerDown = (event: PointerEvent) => {
      const { editingId } = textEditingStore.getState();
      if (editingId && nodeIdInPath(event) !== editingId) stopEditing();
    };

    viewport.addEventListener("dblclick", onDoubleClick);
    viewport.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => {
      viewport.removeEventListener("dblclick", onDoubleClick);
      viewport.removeEventListener("pointerdown", onPointerDown, { capture: true });
    };
  }, [viewportRef, nodeStore]);
}
