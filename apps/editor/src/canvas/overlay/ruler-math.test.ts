import { describe, expect, it } from "vitest";
import { MIN_LABEL_SPACING, niceStep, rulerTicks } from "./ruler-math";

describe("ruler-math (ED-029)", () => {
  it("niceStep memilih langkah deret 1/2/5 ×10ⁿ dengan jarak layar ≥ minimum", () => {
    for (const zoom of [0.1, 0.25, 0.5, 1, 2, 4, 8, 16]) {
      const step = niceStep(zoom);
      // Jarak antar tick di layar tidak boleh di bawah minimum.
      expect(step * zoom).toBeGreaterThanOrEqual(MIN_LABEL_SPACING);
      // Mantissa termasuk {1,2,5} (×10ⁿ).
      const mantissa = step / 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 5]).toContain(Math.round(mantissa));
    }
  });

  it("niceStep lebih kecil saat zoom lebih besar (tick lebih rapat di world)", () => {
    expect(niceStep(2)).toBeLessThanOrEqual(niceStep(1));
    expect(niceStep(8)).toBeLessThanOrEqual(niceStep(2));
  });

  it("rulerTicks menempatkan tick di kelipatan step dalam rentang viewport", () => {
    // zoom 1, camera 0 → world 0..500 di layar 0..500; step 100.
    const ticks = rulerTicks(500, 0, 1, 100, 0);
    expect(ticks.map((t) => t.label)).toEqual([0, 100, 200, 300, 400, 500]);
    expect(ticks.map((t) => t.pos)).toEqual([0, 100, 200, 300, 400, 500]);
  });

  it("rulerTicks memetakan world→screen dengan pan & zoom, label relatif origin", () => {
    // camera x=50, zoom=2, step=100, origin=100: world w → screen 50 + w*2; label = w - 100.
    const ticks = rulerTicks(400, 50, 2, 100, 100);
    expect(ticks[0]).toEqual({ pos: 50, label: -100 }); // w=0
    expect(ticks[1]).toEqual({ pos: 250, label: 0 }); // w=100 (origin)
    expect(ticks.at(-1)?.pos).toBeLessThanOrEqual(400);
  });

  it("rulerTicks kosong bila step jauh lebih besar dari rentang terlihat? tetap menyertakan tick di dalam rentang", () => {
    const ticks = rulerTicks(50, 0, 1, 100, 0);
    // world 0..50, step 100 → hanya w=0.
    expect(ticks.map((t) => t.label)).toEqual([0]);
  });
});
