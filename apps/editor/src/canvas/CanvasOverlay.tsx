import { useStore } from "zustand";
import { cameraStore } from "./camera-store";
import { DEMO_BOXES } from "./DemoWorldContent";

// ED-014: overlay digambar dalam koordinat screen agar garis selalu 1px di zoom berapa pun.
export function CanvasOverlay() {
  const { x, y, zoom } = useStore(cameraStore);
  // SEMENTARA: outline kotak demo pertama; diganti selection overlay sungguhan di T0.5.6.
  const target = DEMO_BOXES[0];

  return (
    <div id="overlay">
      {target && (
        <div
          className="overlay-outline"
          style={{
            transform: `translate(${target.x * zoom + x}px, ${target.y * zoom + y}px)`,
            width: target.width * zoom,
            height: target.height * zoom,
          }}
        />
      )}
      <div className="overlay-zoom-indicator">{Math.round(zoom * 100)}%</div>
    </div>
  );
}
