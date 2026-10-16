import { describe, expect, it } from "vitest";
import { computeSnap, type Rect } from "./snap";

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

describe("computeSnap (ED-073)", () => {
  const THRESHOLD = 5;

  it("snap tepi kiri ke tepi kiri sibling dalam threshold", () => {
    // moving kiri 103, sibling kiri 100 → delta -3 (≤5).
    const result = computeSnap(rect(103, 0, 20, 20), [rect(100, 200, 40, 40)], THRESHOLD);
    expect(result.dx).toBe(-3);
    expect(result.dy).toBe(0);
    expect(result.guides.some((g) => g.axis === "x" && g.position === 100)).toBe(true);
  });

  it("di luar threshold → tanpa snap", () => {
    expect(computeSnap(rect(110, 0, 20, 20), [rect(100, 0, 40, 40)], THRESHOLD).dx).toBe(0);
  });

  it("snap pusat ke pusat (center-x)", () => {
    // moving center 63 (x53+10), candidate center 60 → delta -3.
    const result = computeSnap(rect(53, 0, 20, 20), [rect(40, 0, 40, 40)], THRESHOLD);
    expect(result.dx).toBe(-3);
  });

  it("memilih penyesuaian terkecil di antara beberapa kandidat", () => {
    // moving garis [100,105,110]; A terdekat (kanan 110→114) +4, B terdekat (kiri 100→98) −2 → pilih −2.
    const result = computeSnap(rect(100, 0, 10, 10), [rect(114, 0, 10, 10), rect(88, 0, 10, 10)], THRESHOLD);
    expect(result.dx).toBe(-2);
  });

  it("snap independen per sumbu", () => {
    // X: kiri 102→100 (−2). Y: atas 207→210? candidate atas 210, moving atas 207 → +3.
    const result = computeSnap(rect(102, 207, 20, 20), [rect(100, 210, 20, 20)], THRESHOLD);
    expect(result).toMatchObject({ dx: -2, dy: 3 });
  });

  it("tepi kanan node bergerak snap ke tepi kanan kandidat", () => {
    // moving kanan = 50+20 = 70; candidate kanan = 0+68 = 68 → delta -2.
    const result = computeSnap(rect(50, 0, 20, 20), [rect(0, 0, 68, 10)], THRESHOLD);
    expect(result.dx).toBe(-2);
  });

  it("tanpa kandidat → tanpa snap & tanpa guide", () => {
    expect(computeSnap(rect(0, 0, 10, 10), [], THRESHOLD)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it("guide membentang menutupi node bergerak & kandidat", () => {
    const result = computeSnap(rect(100, 0, 20, 20), [rect(100, 200, 20, 20)], THRESHOLD);
    const guide = result.guides.find((g) => g.axis === "x" && g.position === 100);
    expect(guide).toMatchObject({ start: 0, end: 220 });
  });
});
