import { fileURLToPath } from "node:url";

// CMP-140: data seed (JSON) di `packages/library-seed/data/**`; kode (skema, lint, import, CLI) di `src/`. Paket ini
// hanya dipakai alat Node (seed DB, test, worker) — tidak untuk bundle browser.

/** Direktori akar data seed. */
export const SEED_DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));

export const SEED_DIRS = {
  components: "components",
  templates: "templates",
  themes: "themes",
  assets: "assets",
} as const;
