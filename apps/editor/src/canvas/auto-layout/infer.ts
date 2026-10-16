// ED-079: inferensi auto-layout dari posisi children (frame freeform → auto-layout). Logika murni (world/local
// koordinat konsisten). Direction dari sebaran pusat; urutan dari posisi sumbu utama; gap = median jarak antar
// children; padding = jarak minimum children ke tepi frame.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChildRect {
  id: string;
  rect: Rect;
}

export interface AutoLayoutInference {
  direction: "row" | "column";
  order: string[];
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
};

const centerX = (r: Rect) => r.x + r.width / 2;
const centerY = (r: Rect) => r.y + r.height / 2;
const spread = (values: number[]) => (values.length === 0 ? 0 : Math.max(...values) - Math.min(...values));

export function inferAutoLayout(frame: Rect, children: readonly ChildRect[]): AutoLayoutInference {
  // Direction: sebaran pusat lebih lebar horizontal → row, selain itu column.
  const direction: "row" | "column" =
    spread(children.map((c) => centerX(c.rect))) >= spread(children.map((c) => centerY(c.rect))) ? "row" : "column";

  const mainStart = (r: Rect) => (direction === "row" ? r.x : r.y);
  const mainSize = (r: Rect) => (direction === "row" ? r.width : r.height);
  const ordered = [...children].sort((a, b) => mainStart(a.rect) - mainStart(b.rect));

  // Gap = median jarak antar tepi children berurutan di sumbu utama (negatif → 0).
  const gaps: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1] as ChildRect;
    const next = ordered[i] as ChildRect;
    gaps.push(mainStart(next.rect) - (mainStart(prev.rect) + mainSize(prev.rect)));
  }
  const gap = Math.max(0, Math.round(median(gaps)));

  // Padding = jarak minimum children ke tepi frame.
  const pad = (value: number) => Math.max(0, Math.round(value));
  const padding =
    children.length === 0
      ? { top: 0, right: 0, bottom: 0, left: 0 }
      : {
          top: pad(Math.min(...children.map((c) => c.rect.y)) - frame.y),
          left: pad(Math.min(...children.map((c) => c.rect.x)) - frame.x),
          right: pad(frame.x + frame.width - Math.max(...children.map((c) => c.rect.x + c.rect.width))),
          bottom: pad(frame.y + frame.height - Math.max(...children.map((c) => c.rect.y + c.rect.height))),
        };

  return { direction, order: ordered.map((c) => c.id), gap, padding };
}
