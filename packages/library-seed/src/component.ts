import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ComponentIdSchema, SubtreeSchema } from "@platform/document-model";
import { z } from "zod";
import { SEED_DATA_DIR, SEED_DIRS } from "./paths";

// CMP-141: satu file `data/components/<kategori>/<slug>.component.json` = satu component dengan ≥ 1 versi.
// M1: `ComponentDefinition` (props, varian, slot — DM-04x) belum ada → definisi = subtree biasa (format
// `insertSubtree`, key `tmp_*` stabil). Diganti `ComponentDefinitionSchema` saat M3 (naik `seedVersion`).

const SlugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug kebab-case");
const LocalizedSchema = z.strictObject({ id: z.string().min(1), en: z.string().min(1) });

// CMP-013 (thumbnail dibuat otomatis saat import, bukan bagian seed).
export const ComponentMetaSchema = z.strictObject({
  name: z.string().regex(/^[A-Z][A-Za-z0-9]{1,63}$/, "name PascalCase (EN)"),
  displayName: z.strictObject({ id: z.string().min(1).max(80), en: z.string().min(1).max(80) }),
  description: z.strictObject({ id: z.string().min(30).max(500), en: z.string().min(30).max(500) }),
  tags: z.array(SlugSchema).min(2),
  keywords: z.strictObject({ id: z.array(z.string().min(1)), en: z.array(z.string().min(1)) }),
  industries: z.array(SlugSchema).optional(),
  aiHints: z.string().min(1).max(500),
  requiresFeatures: z.array(z.enum(["dynamic", "auth", "commerce"])).optional(),
});

// CMP-003: `page` (root = page node) menyusul bersama ComponentDefinition M3 — subtree tidak boleh berisi page.
export const ComponentKindSchema = z.enum(["element", "block", "section", "layout"]);

export const SeedComponentVersionSchema = z.strictObject({
  // CMP-042: label semver; urutan & jenis bump dicek di T1.11.3.
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "versi MAJOR.MINOR.PATCH"),
  status: z.enum(["draft", "published"]),
  changelog: LocalizedSchema,
  definition: z.strictObject({ subtree: SubtreeSchema }),
});

export const SeedComponentFileSchema = z.strictObject({
  $schema: z.string().optional(),
  seedVersion: z.literal(1),
  // Stabil; di-import sebagai UUID v5 dari `slug` (CMP-141). Format DM-007 (`cmp_` + 6–24 [0-9a-z]).
  id: ComponentIdSchema,
  slug: SlugSchema,
  kind: ComponentKindSchema,
  categorySlug: SlugSchema,
  meta: ComponentMetaSchema,
  versions: z.array(SeedComponentVersionSchema).min(1),
});

export type SeedComponentFile = z.infer<typeof SeedComponentFileSchema>;

export interface SeedFile {
  // Path relatif terhadap `data/` (dipakai di pesan error, CMP-143).
  path: string;
  json: unknown;
}

/** Semua file `*.component.json` di bawah `data/components/` (urut path agar deterministik). */
export function readComponentFiles(dataDir = SEED_DATA_DIR): SeedFile[] {
  const root = join(dataDir, SEED_DIRS.components);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".component.json")) files.push(full);
    }
  };
  walk(root);
  return files.sort().map((file) => ({
    path: relative(dataDir, file),
    json: JSON.parse(readFileSync(file, "utf8")) as unknown,
  }));
}
