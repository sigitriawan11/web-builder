import { screenDeltaToWorld } from "../geometry/coordinates";
import type { Point } from "../interactions/interaction-machine";

/**
 * Geser world dari titik tekan ke titik pointer sekarang (ED-062). Satuan screen dibagi zoom,
 * sehingga node selalu mengikuti pointer di zoom berapa pun. `constrainAxis` (Shift) mengunci ke
 * sumbu dominan.
 */
export function moveDelta(
  origin: Point,
  current: Point,
  zoom: number,
  constrainAxis: boolean,
): { dx: number; dy: number } {
  const delta = screenDeltaToWorld(current.x - origin.x, current.y - origin.y, zoom);
  if (!constrainAxis) return delta;
  return Math.abs(delta.dx) >= Math.abs(delta.dy) ? { dx: delta.dx, dy: 0 } : { dx: 0, dy: delta.dy };
}

// ED-062: posisi akhir dibulatkan ke grid pixel (snap pixel aktif secara default).
export function movedPosition(
  start: { x: number; y: number },
  delta: { dx: number; dy: number },
): { x: number; y: number } {
  return { x: Math.round(start.x + delta.dx), y: Math.round(start.y + delta.dy) };
}
