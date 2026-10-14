// @platform/library-seed (CMP-140): sumber awal library platform sebelum Mode Admin (M3) — data seed JSON di `data/**`
// tervalidasi skema `@platform/document-model`; kode skema/lint/import di `src/`. Hanya untuk alat Node (seed, test).
export { loadCategories, SeedCategoriesFileSchema, type SeedCategory, SeedCategorySchema } from "./categories";
export { SEED_DATA_DIR, SEED_DIRS } from "./paths";
