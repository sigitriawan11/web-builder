import { clampZoom } from "../../canvas/zoom-limits";

/**
 * ED-009: isi kolom zoom bottom bar → skala zoom. Menerima "150", "150%", "1.5x" / "1,5x" (desimal koma
 * Indonesia); hasil dibatasi rentang zoom (5–1600%). Input tidak valid → null (nilai lama dipertahankan).
 */
export function parseZoomInput(input: string): number | null {
  const text = input.trim().replace(",", ".").toLowerCase();
  const factor = /^(\d+(?:\.\d+)?)\s*x$/.exec(text);
  if (factor) return clampZoom(Number(factor[1]));
  const percent = /^(\d+(?:\.\d+)?)\s*%?$/.exec(text);
  if (!percent) return null;
  const value = Number(percent[1]);
  return value > 0 ? clampZoom(value / 100) : null;
}
