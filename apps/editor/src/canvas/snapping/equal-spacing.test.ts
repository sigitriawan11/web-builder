import { describe, expect, it } from "vitest";
import { equalSpacingSnap } from "./equal-spacing";
import type { Rect } from "./snap";

const box = (x: number, y: number, w = 100, h = 100): Rect => ({ x, y, width: w, height: h });

describe("equalSpacingSnap (ED-077)", () => {
  it("AC: drag kotak tengah ke antara dua kotak → pusatkan (gap kiri = gap kanan)", () => {
    const b1 = box(0, 0);
    const b3 = box(300, 0);
    // b2 mendekati pusat (seharusnya x=150 agar gap 50/50).
    const snap = equalSpacingSnap(box(162, 0), [b1, b3], 20);
    expect(snap.dx).toBe(-12); // 150 − 162
    expect(snap.dy).toBe(0);
    expect(snap.spacings).toContainEqual({ axis: "x", gap: 50 });
  });

  it("AC: drag kotak ketiga → samakan dengan gap yang sudah ada (deret berjarak sama)", () => {
    const b1 = box(0, 0);
    const b2 = box(150, 0); // gap b1→b2 = 50
    // b3 dekat 290; target agar gap b2→b3 = 50 → start 250+50 = 300.
    const snap = equalSpacingSnap(box(293, 0), [b1, b2], 20);
    expect(snap.dx).toBe(7); // 300 − 293
    expect(snap.spacings).toContainEqual({ axis: "x", gap: 50 });
  });

  it("bekerja pada sumbu vertikal (kolom berjarak sama)", () => {
    const b1 = box(0, 0);
    const b3 = box(0, 300);
    const snap = equalSpacingSnap(box(0, 158), [b1, b3], 20);
    expect(snap.dy).toBe(-8); // 150 − 158
    expect(snap.spacings).toContainEqual({ axis: "y", gap: 50 });
  });

  it("di luar threshold → tidak snap", () => {
    const snap = equalSpacingSnap(box(200, 0), [box(0, 0), box(300, 0)], 20);
    expect(snap.dx).toBe(0);
    expect(snap.spacings).toEqual([]);
  });

  it("kandidat tidak sejajar (baris berbeda) diabaikan", () => {
    // b1 & b3 di baris berbeda dari moving → tidak dianggap untuk equal-spacing horizontal.
    const snap = equalSpacingSnap(box(162, 0), [box(0, 400), box(300, 400)], 20);
    expect(snap.dx).toBe(0);
  });

  it("kurang dari 2 sibling sejajar → tidak ada equal-spacing", () => {
    expect(equalSpacingSnap(box(162, 0), [box(0, 0)], 20)).toEqual({ dx: 0, dy: 0, spacings: [] });
  });
});
