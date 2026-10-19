import { describe, expect, it } from "vitest";
import { loadCategories, validateSeedLibrary } from "../src";

// ACC-292 / T3.3.10: seluruh konten library wajib dwibahasa (ID + EN) non-kosong. Schema (LocalizedSchema) sudah
// menegakkan min-length; test ini mengunci jaminan itu untuk seluruh data repo seed.
const bilingual = (value: { id?: unknown; en?: unknown } | undefined, where: string) => {
  expect(typeof value?.id === "string" && value.id.length > 0, `${where}.id`).toBe(true);
  expect(typeof value?.en === "string" && value.en.length > 0, `${where}.en`).toBe(true);
};

describe("konten library dwibahasa (ACC-292)", () => {
  it("setiap kategori punya name (ID+EN); description bila ada", () => {
    for (const cat of loadCategories()) {
      bilingual(cat.name, `category ${cat.slug} name`);
      if (cat.description) bilingual(cat.description, `category ${cat.slug} description`);
    }
  });

  it("setiap component punya displayName & description (ID+EN); keywords dua bahasa", () => {
    for (const { seed } of validateSeedLibrary().components) {
      bilingual(seed.meta.displayName, `component ${seed.slug} displayName`);
      bilingual(seed.meta.description, `component ${seed.slug} description`);
      expect(Array.isArray(seed.meta.keywords.id), `${seed.slug} keywords.id`).toBe(true);
      expect(Array.isArray(seed.meta.keywords.en), `${seed.slug} keywords.en`).toBe(true);
      for (const version of seed.versions)
        bilingual(version.changelog, `component ${seed.slug}@${version.version} changelog`);
    }
  });
});
