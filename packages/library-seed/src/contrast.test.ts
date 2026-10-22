import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "./contrast";

// Sanity formula WCAG (T3.11.1): nilai acuan diketahui.
describe("contrastRatio", () => {
  it("putih vs hitam = 21; sama = 1", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
  it("simetris (urutan fg/bg tak mengubah rasio)", () => {
    expect(contrastRatio("#2563EB", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#2563EB"), 5);
  });
  it("blue-600 pada putih lulus AA (~5.17)", () => {
    expect(contrastRatio("#2563EB", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  it("alpha (8-digit) diabaikan", () => {
    expect(relativeLuminance("#FFFFFF00")).toBeCloseTo(relativeLuminance("#FFFFFF"), 5);
  });
});
