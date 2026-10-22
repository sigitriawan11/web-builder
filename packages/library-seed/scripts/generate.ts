import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ComponentSpec, toComponentFile } from "./builder";
import { CTA } from "./catalog/cta";
import { ELEMENTS } from "./catalog/elements";
import { FAQ } from "./catalog/faq";
import { FEATURES } from "./catalog/features";
import { HERO } from "./catalog/hero";
import { PRICING } from "./catalog/pricing";

// Generator file seed component dari katalog (T3.11.x). `pnpm --filter @platform/library-seed gen`. File di-emit ke
// `data/components/<kategori>/<slug>.component.json`; validasi dijalankan oleh `library-seed` test (validateSeedLibrary).

const DATA = fileURLToPath(new URL("../data/components/", import.meta.url));

const CATALOG: ComponentSpec[] = [...ELEMENTS, ...HERO, ...FEATURES, ...CTA, ...FAQ, ...PRICING];

let written = 0;
for (const spec of CATALOG) {
  const file = toComponentFile(spec);
  const path = join(DATA, spec.categorySlug, `${spec.slug}.component.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  written++;
}
console.log(`Generated ${written} component(s) across ${new Set(CATALOG.map((c) => c.categorySlug)).size} categori.`);
