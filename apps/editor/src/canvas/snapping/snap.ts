// ED-073: smart guides & snapping ke node lain. Logika murni dalam koordinat world; threshold diberikan dalam
// world px (pemanggil: 5px screen ÷ zoom). Snap independen per sumbu: cari penyesuaian terkecil yang membawa
// salah satu tepi/pusat node yang bergerak ke dalam threshold dari tepi/pusat kandidat.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Garis guide (world): posisi di sumbu + rentang tegak lurus yang mencakup node bergerak & kandidat yang match.
export interface Guide {
  axis: "x" | "y";
  // Posisi garis di sumbu-nya (x untuk garis vertikal, y untuk horizontal).
  position: number;
  // Rentang melintang (min..max) di sumbu lain, agar garis membentang menutupi node terkait.
  start: number;
  end: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

const EPSILON = 0.01;

// Tiga garis acuan node pada satu sumbu: tepi awal, pusat, tepi akhir.
function linesX(rect: Rect): number[] {
  return [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
}
function linesY(rect: Rect): number[] {
  return [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
}

// Penyesuaian terkecil (|delta| ≤ threshold) agar satu garis `moving` bertemu satu garis `candidate`.
function bestDelta(movingLines: readonly number[], candidateLines: readonly number[], threshold: number): number {
  let best = 0;
  let bestAbs = threshold + EPSILON;
  for (const ml of movingLines) {
    for (const cl of candidateLines) {
      const delta = cl - ml;
      const abs = Math.abs(delta);
      if (abs <= threshold && abs < bestAbs) {
        bestAbs = abs;
        best = delta;
      }
    }
  }
  return best;
}

/**
 * Hitung snap untuk `moving` (rect world) terhadap `candidates`. `threshold` dalam world px. Mengembalikan
 * penyesuaian per sumbu (`dx`/`dy`) dan garis guide untuk tiap garis kandidat yang kini sejajar.
 */
export function computeSnap(moving: Rect, candidates: readonly Rect[], threshold: number): SnapResult {
  const movingX = linesX(moving);
  const movingY = linesY(moving);
  const candX = candidates.flatMap(linesX);
  const candY = candidates.flatMap(linesY);

  const dx = bestDelta(movingX, candX, threshold);
  const dy = bestDelta(movingY, candY, threshold);

  const snapped: Rect = { ...moving, x: moving.x + dx, y: moving.y + dy };
  const guides: Guide[] = [];

  // Guide X (vertikal): garis kandidat yang kini bertemu salah satu garis vertikal node.
  for (const cl of new Set(candX)) {
    if (!linesX(snapped).some((ml) => Math.abs(ml - cl) < 0.5)) continue;
    const matched = candidates.filter((c) => linesX(c).some((l) => Math.abs(l - cl) < 0.5));
    const ys = [snapped.y, snapped.y + snapped.height, ...matched.flatMap((c) => [c.y, c.y + c.height])];
    guides.push({ axis: "x", position: cl, start: Math.min(...ys), end: Math.max(...ys) });
  }
  for (const cl of new Set(candY)) {
    if (!linesY(snapped).some((ml) => Math.abs(ml - cl) < 0.5)) continue;
    const matched = candidates.filter((c) => linesY(c).some((l) => Math.abs(l - cl) < 0.5));
    const xs = [snapped.x, snapped.x + snapped.width, ...matched.flatMap((c) => [c.x, c.x + c.width])];
    guides.push({ axis: "y", position: cl, start: Math.min(...xs), end: Math.max(...xs) });
  }

  return { dx, dy, guides };
}
