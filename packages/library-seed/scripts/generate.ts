import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ComponentSpec, toComponentFile } from "./builder";
import { CONTENT } from "./catalog/content";
import { CTA } from "./catalog/cta";
import { ELEMENTS } from "./catalog/elements";
import { FAQ } from "./catalog/faq";
import { FEATURES } from "./catalog/features";
import { FOOTER } from "./catalog/footer";
import { HERO } from "./catalog/hero";
import { NAVBAR } from "./catalog/navbar";
import { PRICING } from "./catalog/pricing";
import { PRODUCT } from "./catalog/product";
import { SOCIAL_PROOF } from "./catalog/social-proof";
import { TEAM_CONTACT } from "./catalog/team-contact";

// Generator file seed component dari katalog (T3.11.x). `pnpm --filter @platform/library-seed gen`. File di-emit ke
// `data/components/<kategori>/<slug>.component.json`; validasi dijalankan oleh `library-seed` test (validateSeedLibrary).

const DATA = fileURLToPath(new URL("../data/components/", import.meta.url));

const CATALOG: ComponentSpec[] = [
  ...ELEMENTS,
  ...HERO,
  ...FEATURES,
  ...CTA,
  ...FAQ,
  ...PRICING,
  ...SOCIAL_PROOF,
  ...NAVBAR,
  ...FOOTER,
  ...CONTENT,
  ...TEAM_CONTACT,
  ...PRODUCT,
];

let written = 0;
for (const spec of CATALOG) {
  const file = toComponentFile(spec);
  const path = join(DATA, spec.categorySlug, `${spec.slug}.component.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  written++;
}
console.log(`Generated ${written} component(s) across ${new Set(CATALOG.map((c) => c.categorySlug)).size} categori.`);
