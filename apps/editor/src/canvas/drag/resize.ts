import type { PositionStyle, StylePatch } from "@platform/document-model";
import type { WorldRect } from "../geometry/geometry-store";
import type { ResizeHandle } from "../interactions/interaction-machine";

// ED-065: batas ukuran node.
export const MIN_SIZE_PX = 1;
export const MAX_SIZE_PX = 100_000;

const clampSize = (value: number) => Math.min(MAX_SIZE_PX, Math.max(MIN_SIZE_PX, Math.round(value)));

// ED-066: modifier saat resize. `aspect` (Shift) mempertahankan rasio w/h; `fromCenter` (Alt) resize simetris
// dari pusat (tepi berlawanan ikut bergerak). "Constrain proportions" inspector = aspect tanpa Shift (dikirim di sini).
export interface ResizeModifiers {
  aspect: boolean;
  fromCenter: boolean;
}

const NO_MODIFIERS: ResizeModifiers = { aspect: false, fromCenter: false };

/**
 * Rect baru (px world) setelah handle digeser `delta` (px world). Tepi yang tidak dipegang handle tidak
 * bergeser (AC ED-065), kecuali modifier: `fromCenter` menjaga pusat tetap, `aspect` menjaga rasio. Ukuran
 * dibulatkan ke integer lalu posisi dihitung dari jangkar (tepi diam atau pusat), sehingga pembulatan tidak
 * menggeser jangkar. M0/M2: melewati sisi berlawanan tidak membuat flip — ukuran berhenti di 1px.
 */
export function resizeRect(
  start: WorldRect,
  handle: ResizeHandle,
  delta: { dx: number; dy: number },
  modifiers: ResizeModifiers = NO_MODIFIERS,
): WorldRect {
  const hasE = handle.includes("e");
  const hasW = handle.includes("w");
  const hasN = handle.includes("n");
  const hasS = handle.includes("s");

  // Perubahan lebar/tinggi dari tepi yang dipegang; `fromCenter` menggandakan karena tepi berlawanan ikut.
  const factor = modifiers.fromCenter ? 2 : 1;
  const dw = ((hasE ? delta.dx : 0) + (hasW ? -delta.dx : 0)) * factor;
  const dh = ((hasS ? delta.dy : 0) + (hasN ? -delta.dy : 0)) * factor;

  let rawWidth = start.width + dw;
  let rawHeight = start.height + dh;

  // ED-066: pertahankan rasio. Sumbu dengan |delta| lebih besar menjadi penggerak (sisi tunggal: yang nonzero).
  if (modifiers.aspect && start.height > 0 && start.width > 0) {
    const ratio = start.width / start.height;
    if (Math.abs(dw) >= Math.abs(dh)) rawHeight = rawWidth / ratio;
    else rawWidth = rawHeight * ratio;
  }

  // Hanya dimensi yang berubah yang dibulatkan; yang diam dibiarkan apa adanya (AC ED-065 subpixel).
  const widthChanged = rawWidth !== start.width;
  const heightChanged = rawHeight !== start.height;
  const width = widthChanged ? clampSize(rawWidth) : start.width;
  const height = heightChanged ? clampSize(rawHeight) : start.height;

  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const centerX = start.x + start.width / 2;
  const centerY = start.y + start.height / 2;

  // Jangkar per sumbu: pusat bila fromCenter; tepi berlawanan bila handle di tepi itu; pusat bila dimensi
  // berubah tanpa handle di sumbu itu (aspect dari tengah sisi); selain itu tak tersentuh (tetap pecahan).
  let x = start.x;
  if (modifiers.fromCenter) x = Math.round(centerX - width / 2);
  else if (hasW) x = right - width;
  else if (hasE) x = start.x;
  else if (widthChanged) x = Math.round(centerX - width / 2);

  let y = start.y;
  if (modifiers.fromCenter) y = Math.round(centerY - height / 2);
  else if (hasN) y = bottom - height;
  else if (hasS) y = start.y;
  else if (heightChanged) y = Math.round(centerY - height / 2);

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
  // Dimensi yang berubah (termasuk yang diturunkan aspect dari sumbu lain, ED-066) menjadi Fixed.
  const widthChanged = next.width !== start.width || handle.includes("e") || handle.includes("w");
  const heightChanged = next.height !== start.height || handle.includes("n") || handle.includes("s");
  const patch: StylePatch = {
    size: {
      ...(widthChanged ? { width: { mode: "fixed", value: next.width, unit: "px" } } : {}),
      ...(heightChanged ? { height: { mode: "fixed", value: next.height, unit: "px" } } : {}),
    },
  };
  if (position?.type === "absolute" && (next.x !== start.x || next.y !== start.y)) {
    // Geser tepi kiri/atas di world = geser posisi relatif parent (tanpa rotasi/skala parent di M0).
    patch.position = { x: position.x + (next.x - start.x), y: position.y + (next.y - start.y) };
  }
  return patch;
}
