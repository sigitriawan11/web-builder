import { createHash } from "node:crypto";
import { readAssetsManifest, SeedAssetsManifestSchema } from "./assets";
import { loadCategories } from "./categories";
import { SEED_DATA_DIR } from "./paths";
import { type SeedIssue, validateSeedLibrary } from "./validate";

// CMP-142: logika import library seed. M1: tabel library (CMP-150+) baru dibuat di M3, jadi yang tersedia adalah
// RENCANA import (dry-run): validasi penuh + daftar entitas yang akan di-upsert dengan kunci stabilnya.

// Namespace tetap UUID v5 library seed (CMP-141) — JANGAN diubah: mengubahnya mengganti semua ID component.
export const SEED_UUID_NAMESPACE = "8b0a4f8e-3c2d-5e6f-9a1b-7c4d2e8f6a10";

/** UUID v5 (RFC 9562, SHA-1) — deterministik dari namespace + nama, sehingga import ulang idempoten. */
export function uuidV5(name: string, namespace = SEED_UUID_NAMESPACE): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const bytes = createHash("sha1").update(ns).update(name, "utf8").digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// JSON kanonis (key terurut) agar hash tidak bergantung urutan key di file.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
  );
}

/** `content_hash` definisi versi (CMP-141: versi published yang berubah isi tanpa naik versi → ditolak saat import). */
export function contentHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

export interface LibraryImportPlan {
  issues: SeedIssue[];
  categories: { slug: string; scope: string; type: string }[];
  components: {
    file: string;
    slug: string;
    componentId: string;
    kind: string;
    categorySlug: string;
    versions: { version: string; status: string; contentHash: string }[];
  }[];
  assets: { assetId: string; file: string; license: string }[];
}

/** Rencana import (CMP-142 langkah 1–2 + ringkasan); tidak menyentuh DB/storage. */
export function planLibraryImport(dataDir = SEED_DATA_DIR): LibraryImportPlan {
  const report = validateSeedLibrary(dataDir);
  const manifest = SeedAssetsManifestSchema.safeParse(readAssetsManifest(dataDir));
  let categories: LibraryImportPlan["categories"] = [];
  try {
    categories = loadCategories(dataDir).map(({ slug, scope, type }) => ({ slug, scope, type }));
  } catch {
    // Sudah dilaporkan di `report.issues` (categories.json).
  }
  return {
    issues: report.issues,
    categories,
    components: report.components.map(({ file, seed }) => ({
      file,
      slug: seed.slug,
      componentId: uuidV5(`component:${seed.slug}`),
      kind: seed.kind,
      categorySlug: seed.categorySlug,
      versions: seed.versions.map((version) => ({
        version: version.version,
        status: version.status,
        contentHash: contentHash(version.definition),
      })),
    })),
    assets: manifest.success
      ? manifest.data.assets.map(({ assetId, file, license }) => ({ assetId, file, license }))
      : [],
  };
}

/** Ringkasan teks rencana untuk CLI. */
export function formatImportPlan(plan: LibraryImportPlan): string {
  const lines = [
    `Kategori: ${plan.categories.length}`,
    `Component: ${plan.components.length} (${plan.components.reduce((sum, component) => sum + component.versions.length, 0)} versi)`,
    ...plan.components.map(
      (component) =>
        `  - ${component.slug} [${component.kind}/${component.categorySlug}] → ${component.componentId} ` +
        component.versions
          .map((version) => `${version.version}:${version.status}:${version.contentHash.slice(0, 12)}`)
          .join(", "),
    ),
    `Asset: ${plan.assets.length}`,
  ];
  return lines.join("\n");
}
