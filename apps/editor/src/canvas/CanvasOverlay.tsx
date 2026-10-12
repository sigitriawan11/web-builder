import { useStore } from "zustand";
import { cameraStore } from "./camera-store";

// ED-014: overlay digambar dalam koordinat screen agar garis selalu 1px di zoom berapa pun.
// Selection box & handles menyusul di T0.5.6.
export function CanvasOverlay() {
  const zoom = useStore(cameraStore, (state) => state.zoom);

  return (
    <div id="overlay">
      <div className="overlay-zoom-indicator">{Math.round(zoom * 100)}%</div>
    </div>
  );
}
