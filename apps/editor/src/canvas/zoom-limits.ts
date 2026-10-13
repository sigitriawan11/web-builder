// ED-013: 5%–1600% (diputuskan T0.8.3; 3200% bisa ditambah cukup dengan menaikkan konstanta ini).
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
