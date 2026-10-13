import type { PositionStyle, StylePatch } from "@platform/document-model";
import type { WorldRect } from "../geometry/geometry-store";
import type { ResizeHandle } from "../interactions/interaction-machine";

// ED-065: batas ukuran node.
export const MIN_SIZE_PX = 1;
export const MAX_SIZE_PX = 100_000;

const clampSize = (value: number) => Math.min(MAX_SIZE_PX, Math.max(MIN_SIZE_PX, Math.round(value)));

/**
 * Rect baru (px world) setelah handle digeser `delta` (px world). Tepi yang tidak dipegang handle
 * tidak pernah bergeser (AC ED-065). Ukuran dibulatkan ke integer lalu posisi dihitung dari tepi yang
 * diam, sehingga pembulatan juga tidak menggeser tepi itu. M0: melewati sisi berlawanan tidak membuat
 * flip — ukuran berhenti di 1px.
 */
export function resizeRect(start: WorldRect, handle: ResizeHandle, delta: { dx: number; dy: number }): WorldRect {
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  let { x, y, width, height } = start;

  if (handle.includes("e")) width = clampSize(start.width + delta.dx);
  if (handle.includes("w")) {
    width = clampSize(start.width - delta.dx);
    x = right - width;
  }
  if (handle.includes("s")) height = clampSize(start.height + delta.dy);
  if (handle.includes("n")) {
    height = clampSize(start.height - delta.dy);
    y = bottom - height;
  }
  return { x, y, width, height };
}

/**
 * Patch style untuk hasil resize (ED-065): hanya dimensi yang di-drag yang berubah, dan menjadi Fixed
 * (dari Hug/Fill). Node absolute ikut digeser bila tepi kiri/atas yang ditarik.
 */
export function resizePatch(
  start: WorldRect,
  next: WorldRect,
  handle: ResizeHandle,
  position: PositionStyle | undefined,
): StylePatch {
  const horizontal = handle.includes("e") || handle.includes("w");
  const vertical = handle.includes("n") || handle.includes("s");
  const patch: StylePatch = {
    size: {
      ...(horizontal ? { width: { mode: "fixed", value: next.width, unit: "px" } } : {}),
      ...(vertical ? { height: { mode: "fixed", value: next.height, unit: "px" } } : {}),
    },
  };
  if (position?.type === "absolute" && (next.x !== start.x || next.y !== start.y)) {
    // Geser tepi kiri/atas di world = geser posisi relatif parent (tanpa rotasi/skala parent di M0).
    patch.position = { x: position.x + (next.x - start.x), y: position.y + (next.y - start.y) };
  }
  return patch;
}
