import { describe, expect, it } from "vitest";
import { catalogFont, catalogFontDef, FONT_CATALOG, searchFonts } from "./font-catalog";

describe("font-catalog (ED-116)", () => {
  it("katalog valid: family unik, weight 400 selalu ada, fallback generik", () => {
    const families = FONT_CATALOG.map((font) => font.family.toLowerCase());
    expect(new Set(families).size).toBe(families.length);
    for (const font of FONT_CATALOG) {
      expect(font.weights).toContain(400);
      expect(["sans-serif", "serif", "monospace"]).toContain(font.fallback);
    }
  });

  it("searchFonts: substring case-insensitive; kosong → semua (dibatasi limit)", () => {
    expect(searchFonts("rob").map((f) => f.family)).toContain("Roboto");
    expect(searchFonts("ROBOTO MONO").map((f) => f.family)).toEqual(["Roboto Mono"]); // case-insensitive, cocok penuh
    expect(searchFonts("mono").map((f) => f.family)).toEqual(expect.arrayContaining(["Roboto Mono", "Space Mono"]));
    expect(searchFonts("zzzzz")).toEqual([]);
    expect(searchFonts("", 5)).toHaveLength(5);
  });

  it("catalogFont: lookup case-insensitive", () => {
    expect(catalogFont("roboto")?.family).toBe("Roboto");
    expect(catalogFont("Tidak Ada")).toBeUndefined();
  });

  it("catalogFontDef: FontDef untuk addFont (source google)", () => {
    const inter = catalogFont("Inter");
    if (!inter) throw new Error("Inter hilang dari katalog");
    expect(catalogFontDef(inter)).toEqual({
      family: "Inter",
      source: "google",
      weights: [...inter.weights],
      fallback: "sans-serif",
    });
  });
});
