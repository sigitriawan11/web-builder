// ED-072: align & distribute. Logika murni dalam koordinat world; mengembalikan DELTA per node (world = local
// karena parent tidak men-skala di M2), sehingga pemanggil cukup menambahkannya ke posisi absolute tiap node.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Box {
  id: string;
  rect: Rect;
}

export type AlignEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

export type Delta = { dx: number; dy: number };

/** Bounding box gabungan beberapa rect (world). */
export function unionBounds(rects: readonly Rect[]): Rect | null {
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

/**
 * Delta geser agar tiap node sejajar `edge` dalam `bounds` (bounding seleksi untuk multi, rect parent untuk
 * satu node absolute). Hanya satu sumbu yang bergeser per edge.
 */
export function alignDeltas(boxes: readonly Box[], edge: AlignEdge, bounds: Rect): Map<string, Delta> {
  const result = new Map<string, Delta>();
  for (const { id, rect } of boxes) {
    let dx = 0;
    let dy = 0;
    switch (edge) {
      case "left":
        dx = bounds.x - rect.x;
        break;
      case "right":
        dx = bounds.x + bounds.width - (rect.x + rect.width);
        break;
      case "hcenter":
        dx = bounds.x + bounds.width / 2 - (rect.x + rect.width / 2);
        break;
      case "top":
        dy = bounds.y - rect.y;
        break;
      case "bottom":
        dy = bounds.y + bounds.height - (rect.y + rect.height);
        break;
      case "vcenter":
        dy = bounds.y + bounds.height / 2 - (rect.y + rect.height / 2);
        break;
    }
    result.set(id, { dx: Math.round(dx), dy: Math.round(dy) });
  }
  return result;
}

/**
 * Delta agar ≥ 3 node berjarak sama di sepanjang `axis`: node pertama & terakhir tetap, sisanya digeser agar
 * celah antar-tepi seragam (AC ED-072). < 3 node → tanpa efek.
 */
export function distributeDeltas(boxes: readonly Box[], axis: DistributeAxis): Map<string, Delta> {
  const result = new Map<string, Delta>();
  if (boxes.length < 3) return result;
  const horizontal = axis === "horizontal";
  const startOf = (box: Box) => (horizontal ? box.rect.x : box.rect.y);
  const sizeOf = (box: Box) => (horizontal ? box.rect.width : box.rect.height);

  const sorted = [...boxes].sort((a, b) => startOf(a) - startOf(b));
  const first = sorted[0] as Box;
  const last = sorted[sorted.length - 1] as Box;
  const span = startOf(last) + sizeOf(last) - startOf(first);
  const sumSizes = sorted.reduce((sum, box) => sum + sizeOf(box), 0);
  const gap = (span - sumSizes) / (sorted.length - 1);

  let cursor = startOf(first);
  for (const box of sorted) {
    const delta = Math.round(cursor - startOf(box));
    result.set(box.id, horizontal ? { dx: delta, dy: 0 } : { dx: 0, dy: delta });
    cursor += sizeOf(box) + gap;
  }
  return result;
}
