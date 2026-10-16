import type { CameraState } from "./geometry/coordinates";
import type { WorldRect } from "./geometry/geometry-store";
import { clampZoom } from "./zoom-limits";

// ED-028: zoom to fit (padding 48 px screen) & zoom to selection (padding 64 px, maks 400%). Fungsi murni; DOM &
// animasi di pemanggil.

export const FIT_PADDING = 48;
export const SELECTION_PADDING = 64;
export const SELECTION_MAX_ZOOM = 4;

export interface ViewportSize {
  width: number;
  height: number;
}

/** Union bounding box; null bila kosong. */
export function unionRects(rects: readonly WorldRect[]): WorldRect | null {
  if (rects.length === 0) return null;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Kamera yang memuat `rect` di tengah viewport dengan padding screen; zoom dibatasi `maxZoom`. */
export function cameraToFit(
  rect: WorldRect,
  viewport: ViewportSize,
  padding: number,
  maxZoom = Number.POSITIVE_INFINITY,
): CameraState {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  // Rect tanpa luas (garis/titik) → hanya dimensi yang punya ukuran yang membatasi.
  const zoomX = rect.width > 0 ? availableWidth / rect.width : Number.POSITIVE_INFINITY;
  const zoomY = rect.height > 0 ? availableHeight / rect.height : Number.POSITIVE_INFINITY;
  const raw = Math.min(zoomX, zoomY, maxZoom);
  const zoom = clampZoom(Number.isFinite(raw) ? raw : 1);
  return {
    zoom,
    x: viewport.width / 2 - (rect.x + rect.width / 2) * zoom,
    y: viewport.height / 2 - (rect.y + rect.height / 2) * zoom,
  };
}

/** Zoom to fit: semua konten; page kosong (tanpa rect) → 100% di origin (AC ED-028). */
export function fitCamera(content: WorldRect | null, viewport: ViewportSize): CameraState {
  if (!content || (content.width === 0 && content.height === 0)) return { x: 0, y: 0, zoom: 1 };
  return cameraToFit(content, viewport, FIT_PADDING);
}

/** Zoom to selection: maks 400% (AC ED-028: node 4×4 px → ≤ 400%). */
export function selectionCamera(selection: WorldRect, viewport: ViewportSize): CameraState {
  return cameraToFit(selection, viewport, SELECTION_PADDING, SELECTION_MAX_ZOOM);
}
