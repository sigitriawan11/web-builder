// ED-098: propagasi constraints saat parent di-resize — reposisi/ubah ukuran child absolute agar perilakunya
// (Left/Right/Both/Center/Scale) konsisten dengan output publish (CSS). Logika murni.

export type Horizontal = "left" | "right" | "leftRight" | "center" | "scale";
export type Vertical = "top" | "bottom" | "topBottom" | "center" | "scale";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Constraints {
  horizontal: Horizontal;
  vertical: Vertical;
}

const DEFAULT: Constraints = { horizontal: "left", vertical: "top" };

// Posisi/ukuran baru di satu sumbu saat ukuran parent berubah `from` → `to`.
function axis(
  kind: Horizontal | Vertical,
  start: number,
  size: number,
  from: number,
  to: number,
): { start: number; size: number } {
  const delta = to - from;
  const scale = from > 0 ? to / from : 1;
  switch (kind) {
    case "right":
    case "bottom":
      return { start: start + delta, size };
    case "leftRight":
    case "topBottom":
      return { start, size: size + delta };
    case "center":
      return { start: start + delta / 2, size };
    case "scale":
      return { start: start * scale, size: size * scale };
    default:
      return { start, size };
  }
}

/** Box baru child absolute setelah parent di-resize dari `from` ke `to`. Nilai dibulatkan ke pixel. */
export function propagateConstraints(
  box: Box,
  constraints: Constraints | undefined,
  from: { width: number; height: number },
  to: { width: number; height: number },
): Box {
  const c = constraints ?? DEFAULT;
  const h = axis(c.horizontal, box.x, box.width, from.width, to.width);
  const v = axis(c.vertical, box.y, box.height, from.height, to.height);
  return { x: Math.round(h.start), y: Math.round(v.start), width: Math.round(h.size), height: Math.round(v.size) };
}
