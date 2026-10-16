import { describe, expect, it } from "vitest";
import { drawRectFrom } from "./draw-geometry";

describe("drawRectFrom (ED-041)", () => {
  it("drag kanan-bawah & kiri-atas dinormalisasi", () => {
    expect(drawRectFrom({ x: 10, y: 10 }, { x: 40, y: 30 })).toEqual({ x: 10, y: 10, width: 30, height: 20 });
    expect(drawRectFrom({ x: 40, y: 30 }, { x: 10, y: 10 })).toEqual({ x: 10, y: 10, width: 30, height: 20 });
  });
  it("Shift = persegi (sisi = maks)", () => {
    expect(drawRectFrom({ x: 0, y: 0 }, { x: 30, y: 50 }, { square: true })).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    expect(drawRectFrom({ x: 0, y: 0 }, { x: -30, y: 10 }, { square: true })).toEqual({
      x: -30,
      y: 0,
      width: 30,
      height: 30,
    });
  });
  it("Alt = dari pusat", () => {
    expect(drawRectFrom({ x: 50, y: 50 }, { x: 70, y: 60 }, { fromCenter: true })).toEqual({
      x: 30,
      y: 40,
      width: 40,
      height: 20,
    });
  });
  it("Shift+Alt = persegi dari pusat", () => {
    expect(drawRectFrom({ x: 50, y: 50 }, { x: 70, y: 60 }, { square: true, fromCenter: true })).toEqual({
      x: 30,
      y: 30,
      width: 40,
      height: 40,
    });
  });
});
