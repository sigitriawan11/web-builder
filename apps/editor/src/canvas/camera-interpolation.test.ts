import { describe, expect, it } from "vitest";
import { easeOutCubic, interpolateCamera } from "./camera-interpolation";

const viewport = { width: 1000, height: 800 };
const centerOf = (camera: { x: number; y: number; zoom: number }) => ({
  x: (500 - camera.x) / camera.zoom,
  y: (400 - camera.y) / camera.zoom,
});

describe("animasi kamera (ED-028)", () => {
  it("ujung = from/to; tengah = zoom geometrik & titik pusat di tengah garis", () => {
    const from = { x: 0, y: 0, zoom: 1 };
    const to = { x: -1500, y: -1200, zoom: 4 };
    expect(interpolateCamera(from, to, 0, viewport)).toEqual(from);
    expect(interpolateCamera(from, to, 1, viewport)).toEqual(to);
    const mid = interpolateCamera(from, to, 0.5, viewport);
    expect(mid.zoom).toBeCloseTo(2);
    const a = centerOf(from);
    const b = centerOf(to);
    expect(centerOf(mid).x).toBeCloseTo((a.x + b.x) / 2);
    expect(centerOf(mid).y).toBeCloseTo((a.y + b.y) / 2);
  });

  it("ease-out: cepat di awal, 0 → 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
