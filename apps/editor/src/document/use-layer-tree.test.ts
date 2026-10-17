import { describe, expect, it } from "vitest";
import { docDropIndex } from "./use-layer-tree";

// ED-138: konversi index tampilan (Figma, kebalikan dokumen) → index dokumen akhir untuk moveNode.
describe("docDropIndex", () => {
  it("display 0 (atas) = dokumen terakhir; display terbawah = dokumen 0", () => {
    // 2 anak tersisa (setelah node ditarik dikeluarkan): display = [c, b] untuk dokumen [b, c].
    expect(docDropIndex(2, 0)).toBe(2); // atas → akhir dokumen
    expect(docDropIndex(2, 1)).toBe(1); // tengah
    expect(docDropIndex(2, 2)).toBe(0); // bawah → awal dokumen
  });

  it("clamp ke [0, remaining]", () => {
    expect(docDropIndex(3, -1)).toBe(3);
    expect(docDropIndex(3, 99)).toBe(0);
    expect(docDropIndex(0, 0)).toBe(0);
  });
});
