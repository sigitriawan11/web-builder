import { describe, expect, it } from "vitest";
import { contrastRatio, WCAG_AA_NORMAL } from "./contrast";
import { loadFonts } from "./fonts";
import { SeedThemeSchema, THEME_PRESETS } from "./themes";

// T3.11.1 / CMP-120/124: 6 preset theme valid, slug unik, pasangan warna teks utama lulus WCAG AA, font berlisensi.

const hex = (value: unknown): string => {
  if (typeof value !== "string") throw new Error(`token warna bukan hex literal: ${JSON.stringify(value)}`);
  return value;
};

describe("theme presets (CMP-120/124)", () => {
  it("minimal 6 preset, slug unik, skema valid", () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(6);
    const slugs = THEME_PRESETS.map((preset) => preset.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const preset of THEME_PRESETS) expect(SeedThemeSchema.safeParse(preset).success).toBe(true);
  });

  it("kontras teks utama lulus WCAG AA (≥ 4.5) di tiap preset", () => {
    for (const { slug, theme } of THEME_PRESETS) {
      const c = theme.tokens.color as Record<string, unknown>;
      const pairs: [string, string, string][] = [
        ["onPrimary/primary", hex(c.onPrimary), hex(c.primary)],
        ["onSurface/background", hex(c.onSurface), hex(c.background)],
        ["onSurface/surface", hex(c.onSurface), hex(c.surface)],
        ["muted/background", hex(c.muted), hex(c.background)],
        ["muted/surface", hex(c.muted), hex(c.surface)],
      ];
      for (const [name, fg, bg] of pairs) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio, `${slug} ${name} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      }
    }
  });

  it("semua font preset berasal dari daftar berlisensi (CMP-191)", () => {
    const licensed = new Set(loadFonts().map((font) => font.family));
    for (const { slug, theme } of THEME_PRESETS) {
      for (const font of theme.fonts) {
        expect(licensed.has(font.family), `${slug}: font "${font.family}" tidak berlisensi`).toBe(true);
      }
    }
  });
});
