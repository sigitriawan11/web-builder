import { describe, expect, it } from "vitest";
import { SNIPPET_DESCRIPTION_MAX, SNIPPET_TITLE_MAX, truncateSnippet } from "./snippet";

describe("truncateSnippet (AC ED-033)", () => {
  it("teks pendek tidak diubah (spasi dirapikan)", () => {
    expect(truncateSnippet("  Toko   Kue  ", SNIPPET_TITLE_MAX)).toBe("Toko Kue");
  });

  it("judul panjang dipotong di batas kata dengan …, ≤ batas", () => {
    const title = "Toko Kue Bu Sari — kue lapis legit, bolu, dan aneka jajanan pasar khas Jakarta";
    const result = truncateSnippet(title, SNIPPET_TITLE_MAX);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(SNIPPET_TITLE_MAX);
    // Dipotong di batas kata: teks sebelum "…" diikuti spasi di judul asli.
    expect(title.startsWith(`${result.slice(0, -1)} `)).toBe(true);
  });

  it("kata sangat panjang tanpa spasi dipotong keras", () => {
    const result = truncateSnippet("a".repeat(200), SNIPPET_DESCRIPTION_MAX);
    expect(result).toHaveLength(SNIPPET_DESCRIPTION_MAX);
    expect(result.endsWith("…")).toBe(true);
  });
});
