import { describe, expect, it } from "vitest";
import { ALLOWED_FONT_LICENSES, loadFonts } from "./fonts";

// T3.9.2 / CMP-191: hanya font Google Fonts (OFL-1.1 / Apache-2.0); tiap font menyimpan lisensi valid, family unik,
// subset latin, bobot 400.
describe("fonts seed (CMP-191)", () => {
  const fonts = loadFonts();

  it("daftar font tidak kosong & family unik", () => {
    expect(fonts.length).toBeGreaterThan(0);
    const families = fonts.map((font) => font.family.toLowerCase());
    expect(new Set(families).size).toBe(families.length);
  });

  it("setiap font punya lisensi valid (OFL-1.1 / Apache-2.0)", () => {
    for (const font of fonts) {
      expect(ALLOWED_FONT_LICENSES).toContain(font.license);
    }
  });

  it("setiap font: subset latin + bobot 400 (teks dasar)", () => {
    for (const font of fonts) {
      expect(font.subsets).toContain("latin");
      expect(font.weights).toContain(400);
    }
  });
});
