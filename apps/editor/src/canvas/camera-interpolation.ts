import type { CameraState } from "./geometry/coordinates";

// ED-028: interpolasi kamera murni (tanpa DOM/store) — dipakai animasi transisi kamera.

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Kamera di progres `t` (0–1) antara `from` & `to`: zoom diinterpolasi logaritmik (terasa linear saat zoom besar),
 * titik world di pusat viewport bergerak lurus — tidak "melengkung" seperti interpolasi x/y mentah.
 */
export function interpolateCamera(
  from: CameraState,
  to: CameraState,
  t: number,
  viewport: { width: number; height: number },
): CameraState {
  if (t >= 1) return to;
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const centerFrom = { x: (cx - from.x) / from.zoom, y: (cy - from.y) / from.zoom };
  const centerTo = { x: (cx - to.x) / to.zoom, y: (cy - to.y) / to.zoom };
  const zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * t);
  const center = {
    x: centerFrom.x + (centerTo.x - centerFrom.x) * t,
    y: centerFrom.y + (centerTo.y - centerFrom.y) * t,
  };
  return { zoom, x: cx - center.x * zoom, y: cy - center.y * zoom };
}
