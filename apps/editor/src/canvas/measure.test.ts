import { describe, expect, it } from "vitest";
import { formatDistance, measureDistances, type Rect } from "./measure";

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

describe("measureDistances (ED-076)", () => {
  it("sibling terpisah horizontal → jarak celah, tanpa ukuran vertikal (tinggi sama)", () => {
    // a kanan 60, b kiri 100 → celah 40; keduanya y 0..40 → vertikal flush (0, difilter).
    const result = measureDistances(rect(0, 0, 60, 40), rect(100, 0, 50, 40));
    expect(result).toEqual([{ axis: "x", distance: 40, start: 60, end: 100, cross: 20 }]);
  });

  it("node di dalam parent → inset tiap sisi", () => {
    // a (20,30,40,20) di dalam b (0,0,100,100): kiri 20, kanan 40, atas 30, bawah 50.
    const result = measureDistances(rect(20, 30, 40, 20), rect(0, 0, 100, 100));
    const byDist = result.map((m) => ({ axis: m.axis, distance: m.distance })).sort((p, q) => p.distance - q.distance);
    expect(byDist).toEqual([
      { axis: "x", distance: 20 },
      { axis: "y", distance: 30 },
      { axis: "x", distance: 40 },
      { axis: "y", distance: 50 },
    ]);
  });

  it("terpisah pada kedua sumbu → jarak X & Y", () => {
    const result = measureDistances(rect(0, 0, 20, 20), rect(50, 60, 20, 20));
    expect(result).toContainEqual({ axis: "x", distance: 30, start: 20, end: 50, cross: 10 });
    expect(result).toContainEqual({ axis: "y", distance: 40, start: 20, end: 60, cross: 10 });
  });

  it("tumpang tindih sebagian di satu sumbu → tanpa ukuran di sumbu itu", () => {
    // Tumpang tindih horizontal (0..30 vs 20..60), terpisah vertikal.
    const result = measureDistances(rect(0, 0, 30, 20), rect(20, 50, 40, 20));
    expect(result.some((m) => m.axis === "x")).toBe(false);
    expect(result).toContainEqual({ axis: "y", distance: 30, start: 20, end: 50, cross: 15 });
  });
});

describe("formatDistance (ED-076)", () => {
  it("bulat tanpa desimal; pecahan 1 desimal", () => {
    expect(formatDistance(40)).toBe("40");
    expect(formatDistance(40.04)).toBe("40");
    expect(formatDistance(40.25)).toBe("40.3");
    expect(formatDistance(12.5)).toBe("12.5");
  });
});
