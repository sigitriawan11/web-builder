// ED-013 P0: 5%–1600%. Rentang final diputuskan di spike (❓ OPEN 02#1, T0.8.3).
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
