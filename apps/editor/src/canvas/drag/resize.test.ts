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
