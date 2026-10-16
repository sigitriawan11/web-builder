import { cameraStore } from "./camera-store";
import { nextZoomStep, zoomAtPoint } from "./interactions/zoom";

// Aksi kamera dari chrome (toolbar/menu, bottom bar) — zoom berpusat di tengah viewport (seperti tombol +/-).
function viewportCenter(): { x: number; y: number } {
  const viewport = document.getElementById("editor-viewport");
  return viewport ? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 } : { x: 0, y: 0 };
}

export function zoomTo(zoom: number): void {
  const camera = cameraStore.getState();
  cameraStore.getState().setCamera(zoomAtPoint(camera, viewportCenter(), zoom));
}

export function zoomStep(direction: "in" | "out"): void {
  zoomTo(nextZoomStep(cameraStore.getState().zoom, direction));
}
