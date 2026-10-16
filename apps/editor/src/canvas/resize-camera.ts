import type { CameraState } from "./geometry/coordinates";

/**
 * AC ED-007: saat viewport canvas berubah ukuran (sidebar di-resize/diciutkan, jendela), titik world di pusat viewport
 * tetap di pusat — kamera digeser setengah perubahan ukuran, canvas tidak "lompat".
 */
export function cameraForResize(
  camera: CameraState,
  previous: { width: number; height: number },
  next: { width: number; height: number },
): CameraState {
  return {
    x: camera.x + (next.width - previous.width) / 2,
    y: camera.y + (next.height - previous.height) / 2,
    zoom: camera.zoom,
  };
}
