import { describe, expect, it } from "vitest";
import { PagePropsSchema } from "../schema";
import { slugify, uniquePagePath } from "./page-paths";

describe("slugify (ED-032)", () => {
  it.each([
    ["Tentang Kami", "tentang-kami"],
    ["  Layanan  Kami!! ", "layanan-kami"],
    ["Café Résumé", "cafe-resume"],
    ["Kue & Roti", "kue-dan-roti"],
    ["Produk 2026", "produk-2026"],
    ["日本語", ""],
    ["---", ""],
  ])("%j → %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("dibatasi 60 karakter tanpa tanda hubung di ujung", () => {
    const slug = slugify(`${"a".repeat(59)} b`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniquePagePath", () => {
  it("unik dengan sufiks; judul tanpa huruf → /page; hasil lolos schema path", () => {
    expect(uniquePagePath("Tentang", ["/", "/tentang"])).toBe("/tentang-2");
    expect(uniquePagePath("Tentang", ["/tentang", "/tentang-2"])).toBe("/tentang-3");
    expect(uniquePagePath("!!!", [])).toBe("/page");
    expect(uniquePagePath("Home", [])).toBe("/home");
    for (const title of ["Tentang Kami", "日本語", "Café"]) {
      expect(PagePropsSchema.shape.path.safeParse(uniquePagePath(title, [])).success).toBe(true);
    }
  });
});
