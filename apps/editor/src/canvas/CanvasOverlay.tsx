import { useStore } from "zustand";
import { cameraStore } from "./camera-store";
import { DEMO_BOXES } from "./DemoWorldContent";
import { worldPoint, worldToScreen } from "./geometry/coordinates";

// Overlay adalah anak `#editor-viewport`, jadi posisinya relatif ke viewport (offset viewport = 0).
const VIEWPORT_ORIGIN = { left: 0, top: 0 };

// ED-014: overlay digambar dalam koordinat screen agar garis selalu 1px di zoom berapa pun.
export function CanvasOverlay() {
  const camera = useStore(cameraStore);
  // SEMENTARA: outline kotak demo pertama; diganti selection overlay sungguhan di T0.5.6.
  const target = DEMO_BOXES[0];
  const topLeft = target ? worldToScreen(worldPoint(target.x, target.y), camera, VIEWPORT_ORIGIN) : undefined;

  return (
    <div id="overlay">
      {target && topLeft && (
        <div
          className="overlay-outline"
          style={{
            transform: `translate(${topLeft.x}px, ${topLeft.y}px)`,
            width: target.width * camera.zoom,
            height: target.height * camera.zoom,
          }}
        />
      )}
      <div className="overlay-zoom-indicator">{Math.round(camera.zoom * 100)}%</div>
    </div>
  );
}
