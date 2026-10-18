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

// ED-060: handle SISI disembunyikan bila node < 24px screen (hanya 4 sudut).
export const MIN_SIZE_FOR_EDGE_HANDLES = 24;
// Di bawah ambang ini, semua handle digeser ke LUAR kotak agar bisa digrab tanpa menumpuk badan node (mis. ikon 24px
// yang drag-nya selalu terbaca "pindah"); independen dari sembunyi-sisi agar node 24–40px tetap punya 8 handle (ED-060).
export const MIN_SIZE_FOR_FLUSH_HANDLES = 40;
// Pergeseran handle ke luar kotak untuk node kecil (≈ setengah area klik handle 10×10 + jarak).
export const HANDLE_OUTSET = 8;

const CORNERS: ResizeHandle[] = ["nw", "ne", "se", "sw"];
const EDGES: ResizeHandle[] = ["n", "e", "s", "w"];

// Titik pusat tiap handle pada kotak screen. Node < 24px: sisi disembunyikan; node < 40px: handle digeser keluar.
export function handlePositions(box: Box): { handle: ResizeHandle; x: number; y: number }[] {
  const { x, y, width, height } = box;
  const hideEdges = width < MIN_SIZE_FOR_EDGE_HANDLES || height < MIN_SIZE_FOR_EDGE_HANDLES;
  const o = width < MIN_SIZE_FOR_FLUSH_HANDLES || height < MIN_SIZE_FOR_FLUSH_HANDLES ? HANDLE_OUTSET : 0;
  const position: Record<ResizeHandle, { x: number; y: number }> = {
    nw: { x: x - o, y: y - o },
    n: { x: x + width / 2, y: y - o },
    ne: { x: x + width + o, y: y - o },
    e: { x: x + width + o, y: y + height / 2 },
    se: { x: x + width + o, y: y + height + o },
    s: { x: x + width / 2, y: y + height + o },
    sw: { x: x - o, y: y + height + o },
    w: { x: x - o, y: y + height / 2 },
  };
  return [...CORNERS, ...(hideEdges ? [] : EDGES)].map((handle) => ({ handle, ...position[handle] }));
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
