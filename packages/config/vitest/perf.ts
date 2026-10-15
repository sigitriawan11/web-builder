import { expect } from "vitest";

// Asersi waktu "indikatif" (target AC kinerja) hanya aktif saat `PERF_ASSERT=1` (`pnpm test:perf`, berurutan).
// Di `pnpm test` biasa (paket paralel, CPU berebut) jalur kodenya tetap dieksekusi tetapi batas waktu tidak dinilai —
// keputusan owner T1.15.4.
export const PERF_ASSERT = process.env.PERF_ASSERT === "1";

export function expectDurationBelow(durationMs: number, limitMs: number): void {
  if (PERF_ASSERT) expect(durationMs).toBeLessThan(limitMs);
}
