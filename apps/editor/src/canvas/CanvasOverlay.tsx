import { useStore } from "zustand";
import { hoverStore } from "../store/hover-store";
import { cameraStore } from "./camera-store";
import { GeometryOutline, outlineNodeFromSearch } from "./GeometryOutline";
import { spikeGeometry } from "./geometry/spike-geometry";
import { MarqueeOverlay } from "./MarqueeOverlay";
import { ReorderOverlay } from "./overlay/ReorderOverlay";
import { SelectionOverlay } from "./overlay/SelectionOverlay";
import { spikeNodeStore } from "./spike-document";

const outlineNodeId = outlineNodeFromSearch(window.location.search);

// ED-014: overlay digambar dalam koordinat screen agar garis selalu 1px dan handle tidak ikut membesar
// di zoom berapa pun. Hanya handle yang menerima pointer; sisanya pointer-events: none.
export function CanvasOverlay() {
  const zoom = useStore(cameraStore, (state) => state.zoom);
  const hoveredId = useStore(hoverStore, (state) => state.hoveredId);

  return (
    <div id="overlay">
      {outlineNodeId && <GeometryOutline nodeId={outlineNodeId} />}
      {hoveredId && <GeometryOutline nodeId={hoveredId} className="overlay-hover-outline" />}
      <SelectionOverlay nodeStore={spikeNodeStore} geometry={spikeGeometry} />
      <MarqueeOverlay />
      <ReorderOverlay />
      <div className="overlay-zoom-indicator">{Math.round(zoom * 100)}%</div>
    </div>
  );
}
