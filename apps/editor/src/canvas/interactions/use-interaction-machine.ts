import { type RefObject, useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { interactionStore } from "../../store/interaction-store";
import { textEditingStore } from "../../store/text-editing-store";
import { effectiveTool, toolStore } from "../../tools/tool-store";
import type { PressTarget, ResizeHandle } from "./interaction-machine";

export interface InteractionAdapterDeps {
  // Node di bawah pointer beserta rantai ancestor-nya (hit-test ED-020), atau null.
  hitTest(clientX: number, clientY: number): { nodeId: string; path: readonly string[] } | null;
  // Node vs area kosong (marquee) untuk hasil hit-test, bergantung pada seleksi (ED-053).
  resolveTarget(hit: { nodeId: string; path: readonly string[] } | null): PressTarget;
}

// Handle resize di overlay (T0.5.6) ditandai `data-handle` + `data-handle-node` (bukan `data-node-id`,
// agar tidak dianggap node canvas oleh hit-test & query DOM).
function handleTarget(event: Event): PressTarget | null {
  for (const target of event.composedPath()) {
    if (!(target instanceof HTMLElement) || !target.dataset.handle) continue;
    const { handle, handleNode } = target.dataset;
    if (handleNode) return { kind: "handle", nodeId: handleNode, handle: handle as ResizeHandle };
  }
  return null;
}

/**
 * Adapter DOM state machine interaksi (ED-023): menerjemahkan event pointer di viewport menjadi event
 * reducer, memasang pointer capture saat drag dimulai, dan meneruskan Esc/blur. Kamera saat panning tetap
 * digerakkan use-pan-interactions; state `panning` di sini mencegah drag/marquee dimulai bersamaan.
 */
export function useInteractionMachine(viewportRef: RefObject<HTMLElement | null>, deps: InteractionAdapterDeps): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { dispatch } = interactionStore.getState();
    const point = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY });

    const onPointerDown = (event: PointerEvent) => {
      const hit = deps.hitTest(event.clientX, event.clientY);
      // Di dalam teks yang sedang diedit, pointer milik editor teks (seleksi teks dengan mouse).
      const { editingId } = textEditingStore.getState();
      if (editingId && hit?.path.includes(editingId)) return;

      const target: PressTarget = handleTarget(event) ?? deps.resolveTarget(hit);
      dispatch({
        type: "pointerDown",
        pointerId: event.pointerId,
        button: event.button,
        point: point(event),
        target,
        panTool: effectiveTool(toolStore.getState()) === "hand",
        additive: event.shiftKey,
      });
    };
    // ED-023: pointer capture dipasang saat tekan BERUBAH menjadi drag, bukan saat ditekan. Capture sejak
    // ditekan membuat click/dblclick diarahkan ke viewport, sehingga double-click edit teks tidak sampai
    // ke node (temuan T0.5.3).
    const onPointerMove = (event: PointerEvent) => {
      const before = interactionStore.getState().state.type;
      dispatch({ type: "pointerMove", pointerId: event.pointerId, point: point(event), shiftKey: event.shiftKey });
      const after = interactionStore.getState().state.type;
      if (before === "pressing" && after !== "pressing" && after !== "idle") viewport.setPointerCapture(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => dispatch({ type: "pointerUp", pointerId: event.pointerId, point: point(event) });
    const onPointerCancel = (event: PointerEvent) => dispatch({ type: "pointerCancel", pointerId: event.pointerId });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isEditableEvent(event)) dispatch({ type: "escape" });
    };
    const onBlur = () => dispatch({ type: "blur" });

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [viewportRef, deps]);
}
