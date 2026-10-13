import type { ResizeHandle } from "../interactions/interaction-machine";

// ED-060: geometri overlay seleksi. Logika murni; rect dalam koordinat yang sama dengan input.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function unionRect(rects: readonly Box[]): Box | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// ED-060: handle sisi disembunyikan bila node lebih kecil dari ini (px screen); sudut tetap tampil.
export const MIN_SIZE_FOR_EDGE_HANDLES = 24;

const CORNERS: ResizeHandle[] = ["nw", "ne", "se", "sw"];
const EDGES: ResizeHandle[] = ["n", "e", "s", "w"];

// Titik pusat tiap handle pada kotak screen.
export function handlePositions(box: Box): { handle: ResizeHandle; x: number; y: number }[] {
  const { x, y, width, height } = box;
  const position: Record<ResizeHandle, { x: number; y: number }> = {
    nw: { x, y },
    n: { x: x + width / 2, y },
    ne: { x: x + width, y },
    e: { x: x + width, y: y + height / 2 },
    se: { x: x + width, y: y + height },
    s: { x: x + width / 2, y: y + height },
    sw: { x, y: y + height },
    w: { x, y: y + height / 2 },
  };
  const showEdges = width >= MIN_SIZE_FOR_EDGE_HANDLES && height >= MIN_SIZE_FOR_EDGE_HANDLES;
  return [...CORNERS, ...(showEdges ? EDGES : [])].map((handle) => ({ handle, ...position[handle] }));
}

export type AxisMode = "fixed" | "hug" | "fill" | undefined;

function formatLength(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Label `W × H` (ED-060). Untuk anak auto-layout, sumbu ber-mode Hug/Fill ditampilkan sebagai kata,
 * mis. `Fill × 48`. `size` dalam px world (bukan screen) agar tidak berubah saat zoom.
 */
export function sizeLabel(
  size: { width: number; height: number },
  modes: { width: AxisMode; height: AxisMode },
  inAutoLayout: boolean,
): string {
  const axis = (value: number, mode: AxisMode) => {
    if (inAutoLayout && mode === "hug") return "Hug";
    if (inAutoLayout && mode === "fill") return "Fill";
    return formatLength(value);
  };
  return `${axis(size.width, modes.width)} × ${axis(size.height, modes.height)}`;
}
