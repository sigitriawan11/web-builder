import {
  contentHash,
  formatImportPlan,
  formatSeedIssues,
  loadCategories,
  planLibraryImport,
  THEME_PRESETS,
  uuidV5,
  validateSeedLibrary,
} from "@platform/library-seed";
import { and, eq } from "drizzle-orm";
import type { Db } from "../src/client";
import { components, componentVersions, libraryCategories, themes } from "../src/schema/library";

// CMP-142: validasi + rencana import library seed (tidak menyentuh DB). Mengembalikan exit code untuk CLI.
export function seedLibrary(options: { dryRun: boolean }): { code: number; valid: boolean } {
  const plan = planLibraryImport();
  if (plan.issues.length > 0) {
    console.error(`Library seed tidak valid (${plan.issues.length} masalah):\n${formatSeedIssues(plan.issues)}`);
    return { code: 1, valid: false };
  }
  console.log(`Rencana import library${options.dryRun ? " (dry-run)" : ""}:\n${formatImportPlan(plan)}`);
  return { code: 0, valid: true };
}

const CATEGORY_NS = (slug: string) => uuidV5(`category:${slug}`);
const COMPONENT_NS = (slug: string) => uuidV5(`component:${slug}`);

export interface LibraryImportCounts {
  categories: number;
  components: number;
  versions: number;
  themes: number;
}

/**
 * CMP-141/CMP-142: tulis library platform ke DB. Idempoten: kategori & component di-upsert by id (UUIDv5 dari slug);
 * versi INSERT-ONLY (skip bila sudah ada; versi published dengan isi berbeda ditolak). Satu transaksi per entitas.
 */
export async function importLibraryToDb(db: Db): Promise<LibraryImportCounts> {
  const plan = planLibraryImport();
  if (plan.issues.length > 0) throw new Error(`Library seed tidak valid:\n${formatSeedIssues(plan.issues)}`);

  const categories = loadCategories();
  await db.transaction(async (tx) => {
    for (const cat of categories) {
      const value = {
        id: CATEGORY_NS(cat.slug),
        slug: cat.slug,
        scope: cat.scope,
        type: cat.type,
        parentId: cat.parentSlug ? CATEGORY_NS(cat.parentSlug) : null,
        name: cat.name,
        description: cat.description ?? null,
        icon: cat.icon ?? null,
        sortOrder: cat.sortOrder,
      };
      await tx
        .insert(libraryCategories)
        .values(value)
        .onConflictDoUpdate({ target: libraryCategories.id, set: { ...value, updatedAt: new Date() } });
    }
  });

  const files = validateSeedLibrary().components;
  let versionCount = 0;
  for (const { seed } of files) {
    const componentId = COMPONENT_NS(seed.slug);
    const publishedVersions = seed.versions.filter((version) => version.status === "published");
    const latest = publishedVersions.at(-1);
    await db.transaction(async (tx) => {
      const componentValue = {
        id: componentId,
        publicId: seed.id,
        slug: seed.slug,
        ownerType: "platform" as const,
        kind: seed.kind,
        categoryId: CATEGORY_NS(seed.categorySlug),
        name: seed.meta.name,
        displayName: seed.meta.displayName,
        description: seed.meta.description,
        tags: seed.meta.tags,
        keywords: seed.meta.keywords,
        industries: seed.meta.industries ?? [],
        aiHints: seed.meta.aiHints,
        requiresFeatures: seed.meta.requiresFeatures ?? [],
        status: (latest ? "published" : "draft") as "published" | "draft",
        latestVersion: latest?.version ?? null,
      };
      await tx
        .insert(components)
        .values(componentValue)
        .onConflictDoUpdate({ target: components.id, set: { ...componentValue, updatedAt: new Date() } });

      for (const [index, version] of seed.versions.entries()) {
        const hash = contentHash(version.definition);
        const existing = await tx
          .select({
            id: componentVersions.id,
            contentHash: componentVersions.contentHash,
            status: componentVersions.status,
          })
          .from(componentVersions)
          .where(and(eq(componentVersions.componentId, componentId), eq(componentVersions.version, version.version)));
        const row = existing[0];
        if (row) {
          // CMP-141: isi versi published tidak boleh berubah tanpa naik versi.
          if (row.status === "published" && row.contentHash !== hash) {
            throw new Error(
              `Versi published "${seed.slug}@${version.version}" diubah tanpa naik versi (content hash beda).`,
            );
          }
          continue; // idempoten: versi sudah ada.
        }
        await tx.insert(componentVersions).values({
          componentId,
          version: version.version,
          versionSeq: index + 1,
          status: version.status,
          definition: version.definition,
          contentHash: hash,
          changelog: version.changelog,
        });
        versionCount++;
      }
    });
  }

  // CMP-120/CMP-124 (T3.11.1): preset theme platform (published). `tokens` jsonb menyimpan definisi Theme LENGKAP
  // (tokens + fonts) agar situs bisa menyalinnya utuh saat memilih preset (DM-044). Idempoten (upsert by id = uuidV5).
  await db.transaction(async (tx) => {
    for (const preset of THEME_PRESETS) {
      const value = {
        id: uuidV5(`theme:${preset.slug}`),
        slug: preset.slug,
        ownerType: "platform" as const,
        displayName: preset.displayName,
        tokens: preset.theme as unknown as Record<string, unknown>,
        mode: preset.mode,
        tags: preset.tags,
        industries: preset.industries,
        status: "published" as const,
        sortOrder: preset.sortOrder,
      };
      await tx
        .insert(themes)
        .values(value)
        .onConflictDoUpdate({ target: themes.id, set: { ...value, updatedAt: new Date() } });
    }
  });

  return {
    categories: categories.length,
    components: files.length,
    versions: versionCount,
    themes: THEME_PRESETS.length,
  };
}
