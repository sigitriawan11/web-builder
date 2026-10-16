import { type RefObject, useEffect } from "react";
import { measureStore } from "../../store/measure-store";
import { selectionStore } from "../../store/selection-store";
import type { CanvasRuntime } from "../canvas-runtime";
import { measureDistances } from "../measure";

// ED-076: dengan node terseleksi, tahan Alt & hover node lain → ukuran jarak (overlay). Hit-test di-throttle rAF.
export function useMeasure(viewportRef: RefObject<HTMLElement | null>, runtime: CanvasRuntime): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    let lastPoint: { x: number; y: number } | null = null;
    let altDown = false;

    const update = () => {
      frame = 0;
      const selected = selectionStore.getState().selectedIds[0];
      if (!altDown || !lastPoint || !selected) {
        measureStore.getState().setMeasurements([]);
        return;
      }
      const hit = runtime.hitTest(lastPoint.x, lastPoint.y);
      const targetId = hit?.path.find((id) => !selectionStore.getState().selectedIds.includes(id));
      const selectedRect = runtime.geometry.store.peekRect(selected);
      const targetRect = targetId ? runtime.geometry.store.peekRect(targetId) : null;
      measureStore
        .getState()
        .setMeasurements(selectedRect && targetRect ? measureDistances(selectedRect, targetRect) : []);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    const onPointerMove = (event: PointerEvent) => {
      lastPoint = { x: event.clientX, y: event.clientY };
      altDown = event.altKey;
      schedule();
    };
    const onPointerLeave = () => {
      lastPoint = null;
      schedule();
    };
    const onKey = (event: KeyboardEvent) => {
      altDown = event.altKey;
      schedule();
    };

    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    const unsubscribe = selectionStore.subscribe(schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      unsubscribe();
      measureStore.getState().setMeasurements([]);
    };
  }, [viewportRef, runtime]);
}
