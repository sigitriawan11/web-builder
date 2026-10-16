import { describe, expect, it } from "vitest";
import type { ResizeHandle } from "../interactions/interaction-machine";
import { MAX_SIZE_PX, MIN_SIZE_PX, resizePatch, resizeRect } from "./resize";

const start = { x: 100, y: 50, width: 200, height: 100 };
const delta = { dx: 30, dy: 20 };

describe("resizeRect per handle (ED-065)", () => {
  it.each<[ResizeHandle, { x: number; y: number; width: number; height: number }]>([
    ["e", { x: 100, y: 50, width: 230, height: 100 }],
    ["w", { x: 130, y: 50, width: 170, height: 100 }],
    ["s", { x: 100, y: 50, width: 200, height: 120 }],
    ["n", { x: 100, y: 70, width: 200, height: 80 }],
    ["se", { x: 100, y: 50, width: 230, height: 120 }],
    ["nw", { x: 130, y: 70, width: 170, height: 80 }],
    ["ne", { x: 100, y: 70, width: 230, height: 80 }],
    ["sw", { x: 130, y: 50, width: 170, height: 120 }],
  ])("%s", (handle, expected) => {
    expect(resizeRect(start, handle, delta)).toEqual(expected);
  });

  it("tepi yang tidak dipegang tidak bergeser (AC ED-065), termasuk saat start pecahan & delta dibulatkan", () => {
    const fractional = { x: 10.3, y: 4.7, width: 99.6, height: 40.2 };
    for (const handle of ["w", "n", "nw"] as const) {
      const next = resizeRect(fractional, handle, { dx: 12.4, dy: -7.9 });
      expect(Math.abs(next.x + next.width - (fractional.x + fractional.width))).toBeLessThan(1e-9);
      expect(Math.abs(next.y + next.height - (fractional.y + fractional.height))).toBeLessThan(1e-9);
      // Hanya dimensi yang di-drag yang dibulatkan; dimensi lain dibiarkan apa adanya.
      expect(Number.isInteger(next.width)).toBe(handle !== "n");
      expect(Number.isInteger(next.height)).toBe(handle !== "w");
    }
  });

  it(`melewati sisi berlawanan tidak flip: berhenti di ${MIN_SIZE_PX}px dengan tepi berlawanan tetap`, () => {
    expect(resizeRect(start, "w", { dx: 500, dy: 0 })).toEqual({ x: 299, y: 50, width: MIN_SIZE_PX, height: 100 });
    expect(resizeRect(start, "n", { dx: 0, dy: 400 })).toEqual({ x: 100, y: 149, width: 200, height: MIN_SIZE_PX });
    expect(resizeRect(start, "se", { dx: -999, dy: -999 })).toMatchObject({ width: MIN_SIZE_PX, height: MIN_SIZE_PX });
  });

  it(`ukuran maksimum ${MAX_SIZE_PX}px`, () => {
    expect(resizeRect(start, "e", { dx: 1e9, dy: 0 }).width).toBe(MAX_SIZE_PX);
  });
});

describe("resizeRect modifier (ED-066)", () => {
  // start = {x:100,y:50,width:200,height:100}; ratio 2:1.
  it("Alt (dari pusat): handle kanan +20 → W+40, X−20, tepi vertikal tetap (AC ED-066)", () => {
    expect(resizeRect(start, "e", { dx: 20, dy: 0 }, { aspect: false, fromCenter: true })).toEqual({
      x: 80,
      y: 50,
      width: 240,
      height: 100,
    });
  });

  it("Alt pada sudut: kedua sumbu simetris dari pusat", () => {
    expect(resizeRect(start, "se", { dx: 20, dy: 10 }, { aspect: false, fromCenter: true })).toEqual({
      x: 80,
      y: 40,
      width: 240,
      height: 120,
    });
  });

  it("Shift (aspect) pada sisi kanan: tinggi ikut skala dari tengah sisi", () => {
    // W 200→260 (×1.3) → H 100→130, tumbuh simetris: Y = 50 − 15 = 35.
    expect(resizeRect(start, "e", { dx: 60, dy: 0 }, { aspect: true, fromCenter: false })).toEqual({
      x: 100,
      y: 35,
      width: 260,
      height: 130,
    });
  });

  it("Shift (aspect) pada sudut: sumbu dengan delta terbesar menggerakkan rasio", () => {
    // dw=60 > dh=5 → W 260, H = 260/2 = 130; sudut se → kiri & atas tetap.
    expect(resizeRect(start, "se", { dx: 60, dy: 5 }, { aspect: true, fromCenter: false })).toEqual({
      x: 100,
      y: 50,
      width: 260,
      height: 130,
    });
  });

  it("Shift+Alt: aspect dari pusat", () => {
    // e +60 dari pusat → dw=120 → W 320 (×1.6) → H 160; pusat tetap → X=100+100−160=40, Y=100−80=20.
    expect(resizeRect(start, "e", { dx: 60, dy: 0 }, { aspect: true, fromCenter: true })).toEqual({
      x: 40,
      y: 20,
      width: 320,
      height: 160,
    });
  });
});

describe("resizePatch (ED-065)", () => {
  it("handle sisi hanya mengubah dimensinya menjadi Fixed", () => {
    expect(resizePatch(start, resizeRect(start, "e", delta), "e", undefined)).toEqual({
      size: { width: { mode: "fixed", value: 230, unit: "px" } },
    });
    expect(resizePatch(start, resizeRect(start, "s", delta), "s", { type: "flow" })).toEqual({
      size: { height: { mode: "fixed", value: 120, unit: "px" } },
    });
  });

  it("sudut mengubah kedua dimensi", () => {
    expect(resizePatch(start, resizeRect(start, "se", delta), "se", undefined).size).toEqual({
      width: { mode: "fixed", value: 230, unit: "px" },
      height: { mode: "fixed", value: 120, unit: "px" },
    });
  });

  it("node absolute ikut digeser saat tepi kiri/atas ditarik; node flow tidak", () => {
    const absolute = { type: "absolute", x: 80, y: 80 } as const;
    expect(resizePatch(start, resizeRect(start, "nw", delta), "nw", absolute).position).toEqual({ x: 110, y: 100 });
    expect(resizePatch(start, resizeRect(start, "se", delta), "se", absolute).position).toBeUndefined();
    expect(resizePatch(start, resizeRect(start, "nw", delta), "nw", { type: "flow" }).position).toBeUndefined();
  });
});

// T2.6.4 / ED-065 & ED-084: resize mengubah mode sizing dimensi yang di-drag menjadi Fixed (dari Hug/Fill),
// tanpa menyentuh sumbu yang diam. `resizePatch` agnostik terhadap mode awal — selalu menulis Fixed untuk
// dimensi yang di-drag/diturunkan, sehingga anak Hug/Fill, frame Hug, dan teks auto-width semuanya jadi Fixed.
describe("resize → mode sizing Fixed (ED-065/ED-084)", () => {
  it("drag horizontal → width Fixed, height tidak disentuh (teks auto-width → fixed width, auto height)", () => {
    const patch = resizePatch(start, resizeRect(start, "e", delta), "e", undefined);
    expect(patch.size?.width).toEqual({ mode: "fixed", value: 230, unit: "px" });
    expect(patch.size && "height" in patch.size).toBe(false);
  });

  it("drag vertikal → height Fixed, width tidak disentuh", () => {
    const patch = resizePatch(start, resizeRect(start, "n", delta), "n", undefined);
    expect(patch.size?.height).toEqual({ mode: "fixed", value: 80, unit: "px" });
    expect(patch.size && "width" in patch.size).toBe(false);
  });

  it("aspect (Shift) pada sisi → dimensi turunan juga jadi Fixed", () => {
    const next = resizeRect(start, "e", { dx: 60, dy: 0 }, { aspect: true, fromCenter: false });
    const patch = resizePatch(start, next, "e", undefined);
    expect(patch.size).toEqual({
      width: { mode: "fixed", value: 260, unit: "px" },
      height: { mode: "fixed", value: 130, unit: "px" },
    });
  });
});
