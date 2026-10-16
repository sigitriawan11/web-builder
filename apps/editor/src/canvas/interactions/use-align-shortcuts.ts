import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { selectionStore } from "../../store/selection-store";
import type { AlignEdge, DistributeAxis } from "../align";
import { applyAlign, applyDistribute } from "../align-commands";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-072: shortcut align (Alt+A/H/D/W/V/S) & distribute (Alt+Shift+H / Alt+Shift+V). Pakai event.code agar tahan
// terhadap karakter khusus Alt di sebagian layout.
const ALIGN_BY_CODE: Record<string, AlignEdge> = {
  KeyA: "left",
  KeyH: "hcenter",
  KeyD: "right",
  KeyW: "top",
  KeyV: "vcenter",
  KeyS: "bottom",
};
const DISTRIBUTE_BY_CODE: Record<string, DistributeAxis> = { KeyH: "horizontal", KeyV: "vertical" };

export function useAlignShortcuts(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || !event.altKey || event.ctrlKey || event.metaKey) return;
      const ids = selectionStore.getState().selectedIds;
      if (ids.length === 0) return;

      if (event.shiftKey) {
        const axis = DISTRIBUTE_BY_CODE[event.code];
        if (!axis) return;
        event.preventDefault();
        applyDistribute(runtime, ids, axis);
        return;
      }
      const edge = ALIGN_BY_CODE[event.code];
      if (!edge) return;
      event.preventDefault();
      applyAlign(runtime, ids, edge);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
