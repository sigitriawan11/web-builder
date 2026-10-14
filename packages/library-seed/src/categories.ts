import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { SEED_DATA_DIR } from "./paths";

// CMP-150: kategori library — fungsional (hero, pricing, …; untuk component) & industri (kuliner, klinik, …; untuk
// template). Slug stabil = kunci upsert saat import (CMP-142).

const SlugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug kebab-case");
const LocalizedSchema = z.strictObject({ id: z.string().min(1).max(80), en: z.string().min(1).max(80) });

export const SeedCategorySchema = z.strictObject({
  slug: SlugSchema,
  scope: z.enum(["component", "template", "both"]),
  type: z.enum(["functional", "industry"]),
  parentSlug: SlugSchema.optional(),
  name: LocalizedSchema,
  description: z.strictObject({ id: z.string().max(300), en: z.string().max(300) }).optional(),
  // Nama ikon Lucide (kebab-case).
  icon: SlugSchema.optional(),
  sortOrder: z.number().int().nonnegative(),
});

export const SeedCategoriesFileSchema = z
  .strictObject({ seedVersion: z.literal(1), categories: z.array(SeedCategorySchema).min(1) })
  .superRefine((file, ctx) => {
    const slugs = new Map<string, number>();
    file.categories.forEach((category, index) => {
      const first = slugs.get(category.slug);
      if (first !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["categories", index, "slug"],
          message: `slug "${category.slug}" duplikat (lihat indeks ${first})`,
        });
      } else slugs.set(category.slug, index);
    });
    // Hierarki 2 level (CMP-150): parent harus ada dan tidak punya parent.
    file.categories.forEach((category, index) => {
      if (category.parentSlug === undefined) return;
      const parent = file.categories.find((candidate) => candidate.slug === category.parentSlug);
      if (!parent || parent.parentSlug !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["categories", index, "parentSlug"],
          message: "parent harus kategori level 1 yang ada",
        });
      }
    });
  });

export type SeedCategory = z.infer<typeof SeedCategorySchema>;

export function loadCategories(dataDir = SEED_DATA_DIR): SeedCategory[] {
  const raw: unknown = JSON.parse(readFileSync(join(dataDir, "categories.json"), "utf8"));
  return SeedCategoriesFileSchema.parse(raw).categories;
}
