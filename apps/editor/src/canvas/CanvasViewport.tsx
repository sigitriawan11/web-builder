import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useToolShortcuts } from "../tools/use-tool-shortcuts";
import { CanvasOverlay } from "./CanvasOverlay";
import { cameraStore, cameraTransform } from "./camera-store";
import { setAppliedZoom } from "./geometry/spike-geometry";
import { NodeStoreContext } from "../document/use-node";
import { CanvasFrames } from "./frames/CanvasFrames";
import { frameOptionsFromSearch } from "./frames/frame-layout";
import { loadSiteFont, SITE_FONT_WEIGHTS, siteFontFromSearch } from "./fonts/site-fonts";
import { canvasStyleSheet, isolationFromSearch, PREFIX_ROOT_CLASS, siteCssFromSearch } from "./isolation";
import { spikeNodeStore, spikePageId } from "./spike-document";
import { useTextEditingInteractions } from "./text-editing/use-text-editing-interactions";
import { useShadowRoot } from "./use-shadow-root";
import { usePanInteractions } from "./interactions/use-pan-interactions";
import { useZoomInteractions } from "./interactions/use-zoom-interactions";

// Setelah kamera diam selama ini, `will-change` dilepas agar teks dirasterisasi ulang dengan tajam (ED-013).
const WILL_CHANGE_IDLE_MS = 150;

const isolation = isolationFromSearch(window.location.search);
const siteCss = siteCssFromSearch(window.location.search);
const frameOptions = frameOptionsFromSearch(window.location.search);
const siteFont = siteFontFromSearch(window.location.search);

export function CanvasViewport() {
  const viewportRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  useToolShortcuts();
  usePanInteractions(viewportRef);
  useZoomInteractions(viewportRef);
  useTextEditingInteractions(viewportRef, spikeNodeStore);
  const shadowRoot = useShadowRoot(worldRef, isolation === "shadow");

  // T0.4.7: FontFace di document.fonts juga berlaku di dalam shadow root canvas.
  useEffect(() => {
    if (siteFont) void loadSiteFont(document.fonts, siteFont, SITE_FONT_WEIGHTS);
  }, []);

  // ED-013: kamera diterapkan langsung ke DOM di requestAnimationFrame, tanpa render React,
  // sehingga node di dalam world tidak pernah di-render ulang karena pan/zoom.
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    let frame = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      frame = 0;
      const camera = cameraStore.getState();
      world.style.transform = cameraTransform(camera);
      setAppliedZoom(camera.zoom);
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

  const content = (
    <>
      <style>{canvasStyleSheet(isolation, siteCss)}</style>
      <NodeStoreContext.Provider value={spikeNodeStore}>
        <CanvasFrames
          pageId={spikePageId}
          showAll={frameOptions.showAll}
          mode={frameOptions.mode}
          scopeClassName={isolation === "prefix" ? PREFIX_ROOT_CLASS : undefined}
          siteFont={siteFont}
        />
      </NodeStoreContext.Provider>
    </>
  );

  return (
    <main id="editor-viewport" data-testid="editor-viewport" ref={viewportRef}>
      {/* `#world` tetap menerima transform kamera; isinya di shadow root atau langsung (ED-016). */}
      <div id="world" ref={worldRef} data-isolation={isolation}>
        {isolation !== "shadow" && content}
      </div>
      {shadowRoot && createPortal(content, shadowRoot)}
      <CanvasOverlay />
    </main>
  );
}
