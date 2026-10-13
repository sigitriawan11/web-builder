import { useStore } from "zustand";
import { previewStore } from "../../store/preview-store";
import { cameraStore } from "../camera-store";

// ED-063: ghost node yang mengikuti pointer + penanda sisip biru 2px (px screen) di indeks tujuan.
export function ReorderOverlay() {
  const reorder = useStore(previewStore, (state) => state.reorder);
  const camera = useStore(cameraStore);
  if (!reorder) return null;

  const toScreen = (x: number, y: number) => ({ x: x * camera.zoom + camera.x, y: y * camera.zoom + camera.y });
  const ghost = toScreen(reorder.ghost.x, reorder.ghost.y);
  const marker = reorder.marker;
  const markerStart = marker ? toScreen(marker.x, marker.y) : null;

  return (
    <>
      <div
        className="overlay-reorder-ghost"
        style={{
          transform: `translate(${ghost.x}px, ${ghost.y}px)`,
          width: reorder.ghost.width * camera.zoom,
          height: reorder.ghost.height * camera.zoom,
        }}
      />
      {marker && markerStart && (
        <div
          className="overlay-insertion-marker"
          data-orientation={marker.orientation}
          style={
            marker.orientation === "vertical"
              ? { transform: `translate(${markerStart.x - 1}px, ${markerStart.y}px)`, width: 2, height: marker.length * camera.zoom }
              : { transform: `translate(${markerStart.x}px, ${markerStart.y - 1}px)`, width: marker.length * camera.zoom, height: 2 }
          }
        />
      )}
    </>
  );
}
