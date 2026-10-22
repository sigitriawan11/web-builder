import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readAssetsManifest, type SeedAsset, SeedAssetsManifestSchema } from "./assets";
import { SEED_DATA_DIR, SEED_DIRS } from "./paths";

// T3.9.1 / CMP-190: setiap gambar contoh library wajib punya sumber + lisensi tercatat & bebas atribusi; file ada.
describe("assets manifest (CMP-190)", () => {
  const parsed = SeedAssetsManifestSchema.parse(readAssetsManifest());
  const assets: SeedAsset[] = parsed.assets;

  it("manifest valid & memuat aset seed", () => {
    expect(assets.length).toBeGreaterThan(0);
  });

  it("setiap aset: lisensi + sumber tercatat, tanpa kewajiban atribusi (konten default)", () => {
    for (const asset of assets) {
      expect(asset.license.trim().length).toBeGreaterThan(0);
      expect(asset.source.trim().length).toBeGreaterThan(0);
      expect(asset.attributionRequired).toBe(false);
    }
  });

  it("file aset yang dirujuk benar-benar ada di data/assets/", () => {
    for (const asset of assets) {
      const file = join(SEED_DATA_DIR, SEED_DIRS.assets, asset.file);
      expect(existsSync(file), `file hilang: ${asset.file}`).toBe(true);
    }
  });

  it("assetId unik", () => {
    const ids = assets.map((asset) => asset.assetId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
