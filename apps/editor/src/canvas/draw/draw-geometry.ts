import type { DrawRect } from "./draw-store";

// ED-041: normalisasi rect dari dua titik world + modifier. Shift = kunci jadi persegi (sisi = maks |dx|,|dy|);
// Alt = dari titik awal sebagai pusat. Hasil selalu width/height ≥ 0.
export function drawRectFrom(
  origin: { x: number; y: number },
  current: { x: number; y: number },
  modifiers: { square?: boolean; fromCenter?: boolean } = {},
): DrawRect {
  let dx = current.x - origin.x;
  let dy = current.y - origin.y;
  if (modifiers.square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }
  if (modifiers.fromCenter) {
    return {
      x: origin.x - Math.abs(dx),
      y: origin.y - Math.abs(dy),
      width: Math.abs(dx) * 2,
      height: Math.abs(dy) * 2,
    };
  }
  return {
    x: Math.min(origin.x, origin.x + dx),
    y: Math.min(origin.y, origin.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}
