// @platform/library-seed (CMP-140): sumber awal library platform sebelum Mode Admin (M3) — data seed JSON di `data/**`
// tervalidasi skema `@platform/document-model`; kode skema/lint/import di `src/`. Hanya untuk alat Node (seed, test).

export { readAssetsManifest, type SeedAsset, SeedAssetSchema, SeedAssetsManifestSchema } from "./assets";
export { loadCategories, SeedCategoriesFileSchema, type SeedCategory, SeedCategorySchema } from "./categories";
export {
  ComponentKindSchema,
  ComponentMetaSchema,
  readComponentFiles,
  type SeedComponentFile,
  SeedComponentFileSchema,
  SeedComponentVersionSchema,
  type SeedFile,
} from "./component";
export { ALLOWED_FONT_LICENSES, loadFonts, type SeedFont, SeedFontSchema, SeedFontsFileSchema } from "./fonts";
export {
  BRAND_ICONS,
  FALLBACK_ICON,
  type IconRef,
  type IconSet,
  isKnownIcon,
  LUCIDE_ALIASES,
  lucideIconNames,
  resolveIcon,
} from "./icons";
export {
  contentHash,
  formatImportPlan,
  type LibraryImportPlan,
  planLibraryImport,
  SEED_UUID_NAMESPACE,
  uuidV5,
} from "./import";
export { SEED_JSON_SCHEMAS, seedJsonSchema } from "./json-schema";
export { LINT_RULES, type LintRule, type LintViolation, lintComponent } from "./lint";
export { SEED_DATA_DIR, SEED_DIRS } from "./paths";
export { formatSeedIssues, jsonPath, type SeedIssue, type SeedLibraryReport, validateSeedLibrary } from "./validate";
