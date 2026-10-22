import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AssetIdSchema } from "@platform/document-model";
import { z } from "zod";
import { SEED_DATA_DIR, SEED_DIRS } from "./paths";

// CMP-140/CMP-143: gambar contoh library dicatat di `data/assets/assets.manifest.json` beserta lisensinya; seed hanya
// boleh merujuk asset yang tercatat.

// CMP-190: setiap aset wajib tercatat lisensinya; konten default library HARUS bebas komersial TANPA kewajiban
// atribusi (user akhir tak menulis atribusi) → `attributionRequired` dipaksa `false`.
export const SeedAssetSchema = z.strictObject({
  assetId: AssetIdSchema,
  // Path relatif `data/assets/`.
  file: z.string().regex(/^images\/[a-z0-9][a-z0-9._-]*$/, "file di bawah images/"),
  kind: z.enum(["image", "svg"]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  // Nama lisensi (mis. "CC0-1.0", "Own work"). Wajib bebas komersial + redistribusi dalam template.
  license: z.string().min(1),
  // Sumber (nama) + URL sumber (CMP-190 `source_url`).
  source: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  author: z.string().min(1).optional(),
  attributionRequired: z.literal(false),
});

export const SeedAssetsManifestSchema = z.strictObject({
  seedVersion: z.literal(1),
  assets: z.array(SeedAssetSchema),
});

export type SeedAsset = z.infer<typeof SeedAssetSchema>;

export function readAssetsManifest(dataDir = SEED_DATA_DIR): unknown {
  const file = join(dataDir, SEED_DIRS.assets, "assets.manifest.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as unknown) : { seedVersion: 1, assets: [] };
}
