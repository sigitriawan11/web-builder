import { deleteNodes, runCommand } from "@platform/document-model";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";
import { UndoContext } from "../document/undo-context";
import { NodeStoreContext } from "../document/use-node";
import { usePreviewWidths } from "../document/use-preview-widths";
import { useUndoShortcuts } from "../document/use-undo-shortcuts";
import { breakpointStore } from "../store/breakpoint-store";
import { uiPreferencesStore } from "../store/ui-preferences";
import { recordEditorAction, reportError } from "../telemetry/telemetry";
import { useImageTool } from "../tools/image/use-image-tool";
import { useHoverHighlight } from "../tools/select/use-hover-highlight";
import { type SelectToolDeps, useSelectTool } from "../tools/select/use-select-tool";
import { useToolShortcuts } from "../tools/use-tool-shortcuts";
import { CanvasOverlay } from "./CanvasOverlay";
import { cameraStore, cameraTransform } from "./camera-store";
import { type CanvasRuntime, CanvasRuntimeContext, usePageId } from "./canvas-runtime";
import { type DragSessionDeps, useDragSessions } from "./drag/use-drag-sessions";
import { useCreateTool } from "./draw/use-create-tool";
import { loadSiteFont, SITE_FONT_WEIGHTS, siteFontFromSearch } from "./fonts/site-fonts";
import { CanvasFrames } from "./frames/CanvasFrames";
import { frameOptionsFromSearch, layoutFrames } from "./frames/frame-layout";
import { FramesContext, useFrameActivation } from "./frames/frames-context";
import { useAlignShortcuts } from "./interactions/use-align-shortcuts";
import { useAutoLayoutShortcut } from "./interactions/use-auto-layout-shortcut";
import { useBreakpointShortcut } from "./interactions/use-breakpoint-shortcut";
import { useBrowserGuards } from "./interactions/use-browser-guards";
import { useClipboardShortcuts } from "./interactions/use-clipboard-shortcuts";
import { useGroupShortcut } from "./interactions/use-group-shortcut";
import { type ImageUploadContext, useImageDrop } from "./interactions/use-image-drop";
import { type InteractionAdapterDeps, useInteractionMachine } from "./interactions/use-interaction-machine";
import { useLayerSearchShortcut } from "./interactions/use-layer-search-shortcut";
import { useLockHide } from "./interactions/use-lock-hide";
import { useMeasure } from "./interactions/use-measure";
import { useNodeLinkShortcut } from "./interactions/use-node-link-shortcut";
import { useNudge } from "./interactions/use-nudge";
import { useOpacityShortcut } from "./interactions/use-opacity-shortcut";
import { usePaletteShortcut } from "./interactions/use-palette-shortcut";
import { usePanInteractions } from "./interactions/use-pan-interactions";
import { usePixelGridShortcut } from "./interactions/use-pixel-grid-shortcut";
import { usePreviewShortcut } from "./interactions/use-preview-shortcut";
import { useRulerShortcut } from "./interactions/use-ruler-shortcut";
import { useSectionShortcuts } from "./interactions/use-section-shortcuts";
import { useSelectAll } from "./interactions/use-select-all";
import { useSelectionNav } from "./interactions/use-selection-nav";
import { useWrapShortcut } from "./interactions/use-wrap-shortcut";
import { useZoomInteractions } from "./interactions/use-zoom-interactions";
import { useZoomShortcuts } from "./interactions/use-zoom-shortcuts";
import { canvasStyleSheet, isolationFromSearch, PREFIX_ROOT_CLASS, siteCssFromSearch } from "./isolation";
import { type NodeErrorActions, NodeErrorActionsContext } from "./render-root/NodeErrorBoundary";
import { cameraForResize } from "./resize-camera";
import { useEmptyTextCleanup } from "./text-editing/use-empty-text-cleanup";
import { useTextEditingInteractions } from "./text-editing/use-text-editing-interactions";
import { useShadowRoot } from "./use-shadow-root";

// Setelah kamera diam selama ini, `will-change` dilepas agar teks dirasterisasi ulang dengan tajam (ED-013).
const WILL_CHANGE_IDLE_MS = 150;

const isolation = isolationFromSearch(window.location.search);
const siteCss = siteCssFromSearch(window.location.search);
const frameOptions = frameOptionsFromSearch(window.location.search);
const siteFont = siteFontFromSearch(window.location.search);

function runtimeDeps(runtime: CanvasRuntime) {
  const interaction: InteractionAdapterDeps = { hitTest: runtime.hitTest, resolveTarget: runtime.resolveTarget };
  const drag: DragSessionDeps = {
    opContext: { doc: runtime.doc, origin: runtime.origin },
    geometry: runtime.geometry.store,
    nodeStore: runtime.nodeStore,
    hitTest: runtime.hitTest,
    viewportOffset: runtime.marquee.viewportOffset,
    undoBoundary: () => runtime.undo.stopCapturing(),
  };
  const select: SelectToolDeps = { nodeStore: runtime.nodeStore, hitTest: runtime.hitTest, marquee: runtime.marquee };
  // ED-228: tombol placeholder node rusak.
  const nodeErrors: NodeErrorActions = {
    deleteNode: (id) => {
      recordEditorAction("deleteBrokenNode");
      runtime.undo.stopCapturing();
      const result = runCommand({ doc: runtime.doc, origin: runtime.origin }, deleteNodes, { ids: [id] });
      if (!result.ok) console.error(`editor: node rusak "${id}" gagal dihapus`, result);
    },
    // Laporan user (ED-228) → Sentry; ID node bukan konten, isi node tidak dikirim.
    reportNode: (id, error) => reportError(error, { area: `node-report:${id}` }),
  };
  const canEdit = () => !runtime.isReadOnly();
  return { interaction, drag, select, nodeErrors, canEdit };
}

// Viewport canvas untuk satu dokumen (`runtime`): playground M0 (fixture) maupun editor situs (Y.Doc realtime).
// `imageUpload` hanya diisi editor situs (butuh siteId & API) → drag-drop gambar aktif; playground = undefined.
export function CanvasViewport({ runtime, imageUpload }: { runtime: CanvasRuntime; imageUpload?: ImageUploadContext }) {
  const viewportRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const deps = useMemo(() => runtimeDeps(runtime), [runtime]);
  const pageId = usePageId(runtime);
  // ED-034: frame breakpoint — semua device (preferensi / `?frames=all` playground) atau fokus breakpoint aktif.
  const activeBreakpoint = useStore(breakpointStore, (state) => state.active);
  const showAllPreference = useStore(uiPreferencesStore, (state) => state.showAllFrames);
  const widths = usePreviewWidths(runtime.doc);
  const showAll = frameOptions.showAll || showAllPreference;
  const frames = useMemo(
    () => layoutFrames(showAll, { widths, focus: activeBreakpoint }),
    [showAll, widths, activeBreakpoint],
  );
  useFrameActivation(viewportRef, frames);
  const { setAppliedZoom } = runtime.geometry;
  useToolShortcuts();
  useUndoShortcuts(runtime.undo, deps.canEdit);
  usePanInteractions(viewportRef);
  useZoomInteractions(viewportRef);
  useZoomShortcuts(runtime);
  useSectionShortcuts(runtime);
  useWrapShortcut(runtime);
  useGroupShortcut(runtime);
  useClipboardShortcuts(runtime, imageUpload);
  useBreakpointShortcut();
  usePreviewShortcut();
  usePaletteShortcut();
  useLayerSearchShortcut();
  useNodeLinkShortcut(runtime);
  useImageDrop(viewportRef, runtime, imageUpload);
  useImageTool(viewportRef, runtime, imageUpload);
  useSelectionNav(runtime);
  useSelectAll(runtime);
  useLockHide(runtime);
  useNudge(runtime);
  useAlignShortcuts(runtime);
  useAutoLayoutShortcut(runtime);
  usePixelGridShortcut();
  useRulerShortcut();
  useOpacityShortcut(runtime);
  useMeasure(viewportRef, runtime);
  useCreateTool(viewportRef, runtime);
  useEmptyTextCleanup(runtime);
  useTextEditingInteractions(viewportRef);
  useSelectTool(viewportRef, deps.select);
  useHoverHighlight(viewportRef, deps.select);
  useDragSessions(deps.drag);
  useInteractionMachine(viewportRef, deps.interaction);
  useBrowserGuards(viewportRef);
  const shadowRoot = useShadowRoot(worldRef, isolation === "shadow");

  // AC ED-007: viewport berubah ukuran (sidebar, jendela) → pusat viewport tetap di titik world yang sama.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let previous = { width: viewport.clientWidth, height: viewport.clientHeight };
    const observer = new ResizeObserver(() => {
      const next = { width: viewport.clientWidth, height: viewport.clientHeight };
      if (next.width === previous.width && next.height === previous.height) return;
      // Ukuran awal 0 (belum ter-layout) bukan resize sungguhan.
      if (previous.width > 0 && previous.height > 0) {
        cameraStore.getState().setCamera(cameraForResize(cameraStore.getState(), previous, next));
      }
      previous = next;
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

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
  }, [setAppliedZoom]);

  const content = (
    <>
      <style>{canvasStyleSheet(isolation, siteCss)}</style>
      <NodeStoreContext.Provider value={runtime.nodeStore}>
        <NodeErrorActionsContext.Provider value={deps.nodeErrors}>
          <UndoContext.Provider value={runtime.undo}>
            <CanvasFrames
              pageId={pageId}
              frames={frames}
              activeBreakpoint={activeBreakpoint}
              mode={frameOptions.mode}
              scopeClassName={isolation === "prefix" ? PREFIX_ROOT_CLASS : undefined}
              siteFont={siteFont}
            />
          </UndoContext.Provider>
        </NodeErrorActionsContext.Provider>
      </NodeStoreContext.Provider>
    </>
  );

  return (
    <CanvasRuntimeContext.Provider value={runtime}>
      <FramesContext.Provider value={frames}>
        <main id="editor-viewport" data-testid="editor-viewport" ref={viewportRef}>
          {/* `#world` tetap menerima transform kamera; isinya di shadow root atau langsung (ED-016). */}
          <div id="world" ref={worldRef} data-isolation={isolation}>
            {isolation !== "shadow" && content}
          </div>
          {shadowRoot && createPortal(content, shadowRoot)}
          <CanvasOverlay />
        </main>
      </FramesContext.Provider>
    </CanvasRuntimeContext.Provider>
  );
}
