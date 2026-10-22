import { describe, expect, it } from "vitest";
import { validateSeedLibrary } from "../src";
import { contrastRatio, WCAG_AA_NORMAL } from "../src/contrast";
import { THEME_PRESETS } from "../src/themes";

// T3.11.14 / CMP-093, CMP-080, CMP-133 — Audit library akhir M3:
// (1) jumlah variasi per kategori memenuhi minimum M3, (2) total ≥ 85 published,
// (3) semua theme preset lulus uji kontras WCAG AA pada pasangan warna teks utama.

// Minimum M3 per kategori. Diturunkan dari target CMP-093 (kolom "P0 di M4 (minimal)") dan
// verifikasi per-task Epic 3.11. Kategori yang rentangnya M3–M4 (Team/Contact/Blog, Product)
// memakai bar M3 dari ROADMAP (T3.11.12 ≥ 7, T3.11.13 ≥ 6), bukan target penuh M4.
const M3_MINIMUMS: Record<string, number> = {
  navigation: 14, // Navigation & Layout
  hero: 10,
  features: 9,
  content: 14,
  "social-proof": 8,
  // Pricing/FAQ/CTA dihitung gabungan (lihat di bawah): 11
  team: 0, // team + contact digabung jadi ≥ 7
  contact: 0,
  product: 6,
  elements: 22,
};

function countByCategory(): Map<string, number> {
  const report = validateSeedLibrary();
  expect(report.issues, "seed harus bebas isu sebelum audit").toEqual([]);
  const counts = new Map<string, number>();
  for (const { seed } of report.components) {
    counts.set(seed.categorySlug, (counts.get(seed.categorySlug) ?? 0) + 1);
  }
  return counts;
}

describe("audit library M3 (T3.11.14 / CMP-093)", () => {
  const counts = countByCategory();
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  it("laporan jumlah per kategori tercetak", () => {
    const rows = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, n]) => ({ category, n }));
    // Laporan jumlah (AC T3.11.14). Dicetak agar tampak di output CI.
    console.table(rows);
    console.log(`Total komponen published: ${total}`);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("total variasi ≥ 85 di akhir M3", () => {
    expect(total, `total = ${total}`).toBeGreaterThanOrEqual(85);
  });

  it.each(Object.entries(M3_MINIMUMS))("kategori %s memenuhi minimum M3 (%d)", (category, min) => {
    expect(counts.get(category) ?? 0, `${category} = ${counts.get(category) ?? 0}`).toBeGreaterThanOrEqual(min);
  });

  it("Pricing/FAQ/CTA gabungan ≥ 11 (CMP-086)", () => {
    const sum = (counts.get("pricing") ?? 0) + (counts.get("faq") ?? 0) + (counts.get("cta") ?? 0);
    expect(sum, `pricing+faq+cta = ${sum}`).toBeGreaterThanOrEqual(11);
  });

  it("Team/Contact gabungan ≥ 7 (CMP-087)", () => {
    const sum = (counts.get("team") ?? 0) + (counts.get("contact") ?? 0);
    expect(sum, `team+contact = ${sum}`).toBeGreaterThanOrEqual(7);
  });

  it("setiap theme preset lulus uji kontras WCAG AA pada warna teks utama (CMP-080)", () => {
    const hex = (value: unknown): string => {
      if (typeof value !== "string") throw new Error(`token warna bukan hex literal: ${JSON.stringify(value)}`);
      return value;
    };
    for (const { slug, theme } of THEME_PRESETS) {
      const c = theme.tokens.color as Record<string, unknown>;
      const pairs: [string, string, string][] = [
        ["onPrimary/primary", hex(c.onPrimary), hex(c.primary)],
        ["onSurface/background", hex(c.onSurface), hex(c.background)],
        ["onSurface/surface", hex(c.onSurface), hex(c.surface)],
        ["muted/background", hex(c.muted), hex(c.background)],
      ];
      for (const [name, fg, bg] of pairs) {
        const ratio = contrastRatio(fg, bg);
        expect(ratio, `${slug} ${name} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      }
    }
  });
});
