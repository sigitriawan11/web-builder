import { describe, expect, it } from "vitest";
import { loadCategories, SeedCategoriesFileSchema } from "../src";

// T1.11.1: struktur paket & data kategori (CMP-140, CMP-150).
describe("data/categories.json", () => {
  it("valid: slug unik, kategori fungsional (§9) & industri (CMP-102) ada", () => {
    const categories = loadCategories();
    const slugs = categories.map((category) => category.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(
      expect.arrayContaining(["hero", "navigation", "pricing", "kuliner", "klinik", "link-in-bio"]),
    );
    expect(categories.filter((category) => category.type === "industry")).toHaveLength(20);
  });

  it("slug duplikat & parent tidak valid ditolak", () => {
    const base = {
      slug: "hero",
      scope: "component",
      type: "functional",
      name: { id: "Hero", en: "Hero" },
      sortOrder: 0,
    };
    expect(SeedCategoriesFileSchema.safeParse({ seedVersion: 1, categories: [base, base] }).success).toBe(false);
    expect(
      SeedCategoriesFileSchema.safeParse({ seedVersion: 1, categories: [{ ...base, parentSlug: "tidak-ada" }] })
        .success,
    ).toBe(false);
    expect(
      SeedCategoriesFileSchema.safeParse({ seedVersion: 1, categories: [{ ...base, slug: "Hero Besar" }] }).success,
    ).toBe(false);
  });
});
