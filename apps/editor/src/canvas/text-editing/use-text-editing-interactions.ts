import { type RefObject, useEffect } from "react";
import { textEditingStore } from "../../store/text-editing-store";

// Elemen node terdalam di jalur event. composedPath menembus shadow root (Opsi A), event.target tidak.
function nodeIdInPath(event: Event): string | null {
  for (const target of event.composedPath()) {
    if (target instanceof HTMLElement && target.dataset.nodeId) return target.dataset.nodeId;
  }
  return null;
}

// ED-115 (spike): klik di luar node yang sedang diedit → selesai. Masuk mode edit lewat double-click
// select tool (ED-038: teks yang sudah terseleksi), lihat tools/select/use-select-tool.ts.
export function useTextEditingInteractions(viewportRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { stopEditing } = textEditingStore.getState();

    const onPointerDown = (event: PointerEvent) => {
      const { editingId } = textEditingStore.getState();
      if (editingId && nodeIdInPath(event) !== editingId) stopEditing();
    };

    viewport.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => viewport.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [viewportRef]);
}
