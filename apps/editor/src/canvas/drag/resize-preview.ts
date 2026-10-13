import type { StylePatch } from "@platform/document-model";
import type { WorldRect } from "../geometry/geometry-store";
import type { ResizeHandle } from "../interactions/interaction-machine";

// Ukuran minimum node saat resize (ED-065, T0.6.3).
export const MIN_SIZE_PX = 1;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Ukuran baru (px world) dari rect awal + geser pointer (px world).
 * SEMENTARA (T0.6.1): hanya handle kanan-bawah `se` sebagai kendaraan verifikasi preview/commit;
 * 7 handle lain & aturan flip menyusul di T0.6.3 (null = belum didukung).
 */
export function resizedSize(
  start: WorldRect,
  handle: ResizeHandle,
  delta: { dx: number; dy: number },
): { width: number; height: number } | null {
  if (handle !== "se") return null;
  return {
    width: round(Math.max(MIN_SIZE_PX, start.width + delta.dx)),
    height: round(Math.max(MIN_SIZE_PX, start.height + delta.dy)),
  };
}

// Resize menghasilkan ukuran tetap (fixed px), seperti Figma: hug/fill berubah menjadi fixed.
export function fixedSizePatch(size: { width: number; height: number }): StylePatch {
  return {
    size: {
      width: { mode: "fixed", value: size.width, unit: "px" },
      height: { mode: "fixed", value: size.height, unit: "px" },
    },
  };
}
