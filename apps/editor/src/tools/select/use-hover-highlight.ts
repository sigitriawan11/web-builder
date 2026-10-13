import { type RefObject, useEffect } from "react";
import type { NodeStore } from "../../document/node-store";
import { hoverStore } from "../../store/hover-store";
import { interactionStore } from "../../store/interaction-store";
import { selectionStore } from "../../store/selection-store";
import { textEditingStore } from "../../store/text-editing-store";
import { effectiveTool, toolStore } from "../tool-store";
import { nodeLookupFrom } from "./node-lookup";
import { resolveClickSelection } from "./selection-depth";

export interface HoverDeps {
  nodeStore: NodeStore;
  hitTest(clientX: number, clientY: number): { nodeId: string; path: readonly string[] } | null;
}

/**
 * ED-038: outline hover pada node yang AKAN terpilih bila diklik (aturan kedalaman ED-051).
 * Hit-test di-throttle per animation frame (ED-020); tidak tampil saat drag/pan, hand tool, atau edit teks.
 */
export function useHoverHighlight(viewportRef: RefObject<HTMLElement | null>, deps: HoverDeps): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const lookup = nodeLookupFrom(deps.nodeStore);
    const { setHovered } = hoverStore.getState();
    let frame = 0;
    let lastPoint: { x: number; y: number } | null = null;

    const update = () => {
      frame = 0;
      const idle = interactionStore.getState().state.type === "idle";
      const selectTool = effectiveTool(toolStore.getState()) === "select";
      if (!lastPoint || !idle || !selectTool || textEditingStore.getState().editingId) {
        setHovered(null);
        return;
      }
      const hit = deps.hitTest(lastPoint.x, lastPoint.y);
      const { selectedIds } = selectionStore.getState();
      const target = hit ? resolveClickSelection(hit.path, selectedIds, lookup) : null;
      setHovered(target && !selectedIds.includes(target) ? target : null);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    const onPointerMove = (event: PointerEvent) => {
      lastPoint = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const onPointerLeave = () => {
      lastPoint = null;
      schedule();
    };
    // Seleksi, tool, atau state interaksi berubah → hover dihitung ulang di titik terakhir.
    const unsubscribes = [selectionStore, toolStore, interactionStore, textEditingStore].map((store) =>
      store.subscribe(schedule),
    );

    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerleave", onPointerLeave);
    return () => {
      cancelAnimationFrame(frame);
      for (const unsubscribe of unsubscribes) unsubscribe();
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [viewportRef, deps]);
}
