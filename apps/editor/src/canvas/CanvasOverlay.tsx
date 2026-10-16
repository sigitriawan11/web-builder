import { useStore } from "zustand";
import { hoverStore } from "../store/hover-store";
import { cameraStore } from "./camera-store";
import { useCanvasRuntime } from "./canvas-runtime";
import { GeometryOutline, outlineNodeFromSearch } from "./GeometryOutline";
import { MarqueeOverlay } from "./MarqueeOverlay";
import { DrawPreview } from "./overlay/DrawPreview";
import { FrameLabels } from "./overlay/FrameLabels";
import { PixelGridOverlay } from "./overlay/PixelGridOverlay";
import { ReorderOverlay } from "./overlay/ReorderOverlay";
import { SelectionOverlay } from "./overlay/SelectionOverlay";
import { SnapGuidesOverlay } from "./overlay/SnapGuidesOverlay";
import { Toasts } from "./overlay/Toasts";

const outlineNodeId = outlineNodeFromSearch(window.location.search);

// ED-014: overlay digambar dalam koordinat screen agar garis selalu 1px dan handle tidak ikut membesar
// di zoom berapa pun. Hanya handle yang menerima pointer; sisanya pointer-events: none.
export function CanvasOverlay() {
  const runtime = useCanvasRuntime();
  const zoom = useStore(cameraStore, (state) => state.zoom);
  const hoveredId = useStore(hoverStore, (state) => state.hoveredId);

  return (
    <div id="overlay">
      <PixelGridOverlay />
      {outlineNodeId && <GeometryOutline nodeId={outlineNodeId} />}
      {hoveredId && <GeometryOutline nodeId={hoveredId} className="overlay-hover-outline" />}
      <SelectionOverlay nodeStore={runtime.nodeStore} geometry={runtime.geometry.store} />
      <MarqueeOverlay />
      <ReorderOverlay />
      <SnapGuidesOverlay />
      <FrameLabels />
      <DrawPreview />
      <Toasts />
      <div className="overlay-zoom-indicator">{Math.round(zoom * 100)}%</div>
    </div>
  );
}
