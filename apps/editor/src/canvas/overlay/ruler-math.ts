// ED-029: matematika murni penggaris (dites terpisah dari komponen). Satuan px world → posisi px screen.

export const MIN_LABEL_SPACING = 56; // jarak minimum antar label (px) agar tidak bertumpuk

export interface RulerTick {
  pos: number; // posisi screen (px) di dalam viewport
  label: number; // nilai relatif origin (px world), dibulatkan
}

/** Langkah "cantik" terkecil (world px) sehingga jaraknya di layar ≥ MIN_LABEL_SPACING (deret 1/2/5 ×10ⁿ). */
export function niceStep(zoom: number, minSpacing = MIN_LABEL_SPACING): number {
  const min = minSpacing / zoom;
  const pow = 10 ** Math.floor(Math.log10(min));
  for (const base of [1, 2, 5, 10]) {
    if (base * pow >= min) return base * pow;
  }
  return 10 * pow;
}

/** Tick major dalam rentang layar [0, length]; `camOffset` = camera.x atau camera.y, `origin` = titik nol ruler. */
export function rulerTicks(length: number, camOffset: number, zoom: number, step: number, origin: number): RulerTick[] {
  const worldStart = (0 - camOffset) / zoom;
  const worldEnd = (length - camOffset) / zoom;
  const first = Math.ceil(worldStart / step) * step;
  const out: RulerTick[] = [];
  for (let w = first; w <= worldEnd; w += step) {
    out.push({ pos: camOffset + w * zoom, label: Math.round(w - origin) });
  }
  return out;
}
