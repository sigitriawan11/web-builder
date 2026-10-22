import { z } from "zod";
import { SeedAssetsManifestSchema } from "./assets";
import { SeedCategoriesFileSchema } from "./categories";
import { SeedComponentFileSchema } from "./component";
import { SeedFontsFileSchema } from "./fonts";
import { SeedPageSchema } from "./pages";

// CMP-143: JSON Schema dari Zod (Zod 4 `z.toJSONSchema`, tanpa paket tambahan) ke `schema/*.json` untuk autocomplete
// di VS Code (`"$schema": "../../../schema/component-seed.schema.json"`). Disinkronkan oleh test (file snapshot).
export const SEED_JSON_SCHEMAS = {
  "component-seed.schema.json": SeedComponentFileSchema,
  "categories.schema.json": SeedCategoriesFileSchema,
  "assets-manifest.schema.json": SeedAssetsManifestSchema,
  "fonts.schema.json": SeedFontsFileSchema,
  "page-seed.schema.json": SeedPageSchema,
} as const;

export function seedJsonSchema(schema: z.ZodType): string {
  return `${JSON.stringify(z.toJSONSchema(schema, { unrepresentable: "any", io: "input" }), null, 2)}\n`;
}
