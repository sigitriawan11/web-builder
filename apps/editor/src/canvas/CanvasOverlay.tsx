import { useStore } from "zustand";
import { selectionStore } from "../store/selection-store";
import { cameraStore } from "./camera-store";
import { GeometryOutline, outlineNodeFromSearch } from "./GeometryOutline";

const outlineNodeId = outlineNodeFromSearch(window.location.search);

// ED-014: overlay digambar dalam koordinat screen agar garis selalu 1px di zoom berapa pun.
// Selection box & handles menyusul di T0.5.6.
export function CanvasOverlay() {
  const zoom = useStore(cameraStore, (state) => state.zoom);
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);

  return (
    <div id="overlay">
      {outlineNodeId && <GeometryOutline nodeId={outlineNodeId} />}
      {selectedIds.map((id) => (
        <GeometryOutline key={id} nodeId={id} className="overlay-selection-outline" />
      ))}
      <div className="overlay-zoom-indicator">{Math.round(zoom * 100)}%</div>
    </div>
  );
}
