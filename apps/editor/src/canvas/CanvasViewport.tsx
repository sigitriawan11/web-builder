import { useEffect, useRef } from "react";
import { useToolShortcuts } from "../tools/use-tool-shortcuts";
import { CanvasOverlay } from "./CanvasOverlay";
import { cameraStore, cameraTransform } from "./camera-store";
import { DemoWorldContent } from "./DemoWorldContent";
import { usePanInteractions } from "./interactions/use-pan-interactions";
import { useZoomInteractions } from "./interactions/use-zoom-interactions";

// Setelah kamera diam selama ini, `will-change` dilepas agar teks dirasterisasi ulang dengan tajam (ED-013).
const WILL_CHANGE_IDLE_MS = 150;

export function CanvasViewport() {
  const viewportRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  useToolShortcuts();
  usePanInteractions(viewportRef);
  useZoomInteractions(viewportRef);

  // ED-013: kamera diterapkan langsung ke DOM di requestAnimationFrame, tanpa render React,
  // sehingga node di dalam world tidak pernah di-render ulang karena pan/zoom.
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    let frame = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      frame = 0;
      world.style.transform = cameraTransform(cameraStore.getState());
    };
    apply();

    const unsubscribe = cameraStore.subscribe(() => {
      world.style.willChange = "transform";
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        world.style.willChange = "";
      }, WILL_CHANGE_IDLE_MS);
      if (frame === 0) frame = requestAnimationFrame(apply);
    });

    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      clearTimeout(idleTimer);
    };
  }, []);

  return (
    <main id="editor-viewport" data-testid="editor-viewport" ref={viewportRef}>
      <div id="world" ref={worldRef}>
        <DemoWorldContent />
      </div>
      <CanvasOverlay />
    </main>
  );
}
