import { useStore } from "zustand";
import { cameraStore } from "../camera-store";
import { drawStore } from "../draw/draw-store";

// ED-037: kotak preview saat menggambar node baru (world → screen).
export function DrawPreview() {
  const camera = useStore(cameraStore);
  const rect = useStore(drawStore, (state) => state.rect);
  if (!rect) return null;
  return (
    <div
      className="overlay-draw-preview"
      data-testid="draw-preview"
      style={{
        transform: `translate(${rect.x * camera.zoom + camera.x}px, ${rect.y * camera.zoom + camera.y}px)`,
        width: rect.width * camera.zoom,
        height: rect.height * camera.zoom,
      }}
    />
  );
}
