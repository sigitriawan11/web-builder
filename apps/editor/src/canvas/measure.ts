// ED-076: pengukuran jarak Alt+hover antara node terseleksi & node yang di-hover. Logika murni (world).
// Node di dalam target (mis. parent) → inset tiap sisi; node terpisah → jarak celah; tumpang tindih sebagian
// pada satu sumbu → tanpa ukuran di sumbu itu.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Measurement {
  axis: "x" | "y";
  distance: number;
  // Garis world: axis "x" membentang (start..end) pada y = cross; axis "y" membentang (start..end) pada x = cross.
  start: number;
  end: number;
  cross: number;
}

const MIN_VISIBLE = 0.5;

// Ukuran pada satu sumbu antara rentang a [aStart,aEnd] dan b [bStart,bEnd]; `cross` = koordinat garis di sumbu lain.
function measureAxis(
  axis: "x" | "y",
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  cross: number,
): Measurement[] {
  const make = (start: number, end: number): Measurement => ({ axis, distance: end - start, start, end, cross });
  // a di dalam b → inset awal & akhir.
  if (bStart <= aStart && aEnd <= bEnd) return [make(bStart, aStart), make(aEnd, bEnd)];
  // Terpisah → jarak celah.
  if (aEnd <= bStart) return [make(aEnd, bStart)];
  if (bEnd <= aStart) return [make(bEnd, aStart)];
  // Tumpang tindih sebagian → tanpa ukuran di sumbu ini.
  return [];
}

/** Ukuran jarak dari `selected` ke `target` pada kedua sumbu; hanya ukuran ≥ 0.5px yang dikembalikan. */
export function measureDistances(selected: Rect, target: Rect): Measurement[] {
  const centerY = selected.y + selected.height / 2;
  const centerX = selected.x + selected.width / 2;
  const horizontal = measureAxis(
    "x",
    selected.x,
    selected.x + selected.width,
    target.x,
    target.x + target.width,
    centerY,
  );
  const vertical = measureAxis(
    "y",
    selected.y,
    selected.y + selected.height,
    target.y,
    target.y + target.height,
    centerX,
  );
  return [...horizontal, ...vertical].filter((m) => m.distance >= MIN_VISIBLE);
}

// ED-076: label world dibulatkan 0 desimal; 1 desimal bila ada pecahan.
export function formatDistance(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
