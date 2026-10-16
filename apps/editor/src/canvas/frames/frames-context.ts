import { createContext, type RefObject, useContext, useEffect } from "react";
import { breakpointStore } from "../../store/breakpoint-store";
import { cameraStore } from "../camera-store";
import { type FrameSpec, frameAtWorldX } from "./frame-layout";

// ED-034: layout frame breakpoint yang sedang tampil (dipakai label overlay & aktivasi frame).
export const FramesContext = createContext<readonly FrameSpec[]>([]);
export const useFrames = () => useContext(FramesContext);

/**
 * ED-034 edge: menekan di dalam frame lain mengaktifkan breakpoint frame itu (seleksi node yang sama dipertahankan).
 * Capture phase: berjalan sebelum seleksi/drag sehingga geometry sudah frame yang benar.
 */
export function useFrameActivation(viewportRef: RefObject<HTMLElement | null>, frames: readonly FrameSpec[]): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || frames.length < 2) return;
    const onPointerDown = (event: PointerEvent) => {
      const rect = viewport.getBoundingClientRect();
      const { x, zoom } = cameraStore.getState();
      const frame = frameAtWorldX(frames, (event.clientX - rect.left - x) / zoom);
      if (frame) breakpointStore.getState().setActive(frame.breakpoint);
    };
    viewport.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => viewport.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [viewportRef, frames]);
}
