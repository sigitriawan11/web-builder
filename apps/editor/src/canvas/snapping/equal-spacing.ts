import type { Rect } from "./snap";

// ED-077: equal-spacing snapping. Saat node dipindah di antara ≥2 sibling, jika jarak antar node bisa dibuat sama,
// snap ke posisi itu + laporkan gap (indikator). Logika murni (world px); threshold dari pemanggil (5px screen ÷ zoom).

export interface SpacingSnap {
  dx: number;
  dy: number;
  // Gap yang menjadi sama per sumbu yang ter-snap (untuk indikator pink, ED-077).
  spacings: { axis: "x" | "y"; gap: number }[];
}

const startOf = (r: Rect, axis: "x" | "y") => (axis === "x" ? r.x : r.y);
const sizeOf = (r: Rect, axis: "x" | "y") => (axis === "x" ? r.width : r.height);
const endOf = (r: Rect, axis: "x" | "y") => startOf(r, axis) + sizeOf(r, axis);

// Dua rect "sejajar" bila saling tumpang tindih pada sumbu TEGAK LURUS (mis. satu baris untuk distribusi X).
function alignedOnPerp(a: Rect, b: Rect, axis: "x" | "y"): boolean {
  const perp = axis === "x" ? "y" : "x";
  return startOf(a, perp) < endOf(b, perp) && startOf(b, perp) < endOf(a, perp);
}

interface AxisResult {
  delta: number;
  gap: number;
}

function axisSnap(moving: Rect, candidates: readonly Rect[], threshold: number, axis: "x" | "y"): AxisResult | null {
  const aligned = candidates
    .filter((c) => alignedOnPerp(moving, c, axis))
    .sort((a, b) => startOf(a, axis) - startOf(b, axis));
  if (aligned.length < 2) return null;

  const mStart = startOf(moving, axis);
  const mSize = sizeOf(moving, axis);
  const mCenter = mStart + mSize / 2;
  const left = aligned.filter((c) => endOf(c, axis) <= mCenter).at(-1);
  const right = aligned.find((c) => startOf(c, axis) >= mCenter);

  let best: AxisResult | null = null;
  const consider = (targetStart: number, gap: number) => {
    if (gap < 0) return;
    const delta = targetStart - mStart;
    if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best.delta))) {
      best = { delta, gap };
    }
  };

  // Case A: di antara tetangga kiri & kanan → pusatkan sehingga gap kiri = gap kanan.
  if (left && right) {
    const span = startOf(right, axis) - endOf(left, axis);
    consider(endOf(left, axis) + (span - mSize) / 2, (span - mSize) / 2);
  }
  // Case B: samakan dengan gap yang sudah ada antar kandidat (perpanjang deret berjarak sama).
  for (let i = 0; i < aligned.length - 1; i++) {
    const current = aligned[i];
    const next = aligned[i + 1];
    if (!current || !next) continue;
    const gap = startOf(next, axis) - endOf(current, axis);
    if (gap < 0) continue;
    if (left) consider(endOf(left, axis) + gap, gap);
    if (right) consider(startOf(right, axis) - gap - mSize, gap);
  }
  return best;
}

export function equalSpacingSnap(moving: Rect, candidates: readonly Rect[], threshold: number): SpacingSnap {
  const x = axisSnap(moving, candidates, threshold, "x");
  const y = axisSnap(moving, candidates, threshold, "y");
  const spacings: SpacingSnap["spacings"] = [];
  if (x) spacings.push({ axis: "x", gap: Math.round(x.gap) });
  if (y) spacings.push({ axis: "y", gap: Math.round(y.gap) });
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, spacings };
}
