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
export { SEED_JSON_SCHEMAS, seedJsonSchema } from "./json-schema";
export { SEED_DATA_DIR, SEED_DIRS } from "./paths";
export { formatSeedIssues, jsonPath, type SeedIssue, type SeedLibraryReport, validateSeedLibrary } from "./validate";
