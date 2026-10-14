import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankSiteDocument, insertSubtree, jsonToYDoc, runCommand, userOrigin } from "@platform/document-model";
import type { z } from "zod";
import { readAssetsManifest, SeedAssetsManifestSchema } from "./assets";
import { SeedCategoriesFileSchema } from "./categories";
import { readComponentFiles, type SeedComponentFile, SeedComponentFileSchema } from "./component";
import { SEED_DATA_DIR } from "./paths";

// CMP-143: validasi seluruh library seed — SEMUA error dilaporkan (bukan berhenti di error pertama), masing-masing
// dengan path file + JSON path, mis. `components/hero/x.component.json: versions[0].definition.subtree…`.

export interface SeedIssue {
  file: string;
  path: string;
  message: string;
}

/** JSON path gaya `versions[0].meta.tags` dari path Zod. */
export function jsonPath(path: readonly PropertyKey[]): string {
  return path
    .filter((key): key is string | number => typeof key !== "symbol")
    .map((key, index) => (typeof key === "number" ? `[${key}]` : `${index === 0 ? "" : "."}${key}`))
    .join("");
}

function zodIssues(file: string, error: z.ZodError): SeedIssue[] {
  return error.issues.map((issue) => ({ file, path: jsonPath(issue.path), message: issue.message }));
}

const semverKey = (version: string) => version.split(".").map((part) => Number(part));
const compareSemver = (a: string, b: string) => {
  const [left, right] = [semverKey(a), semverKey(b)];
  for (let index = 0; index < 3; index++) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

// Semua `assetId` di node subtree (gambar, fill gambar, link asset) beserta JSON path-nya.
function assetRefs(value: unknown, path: string): { assetId: string; path: string }[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => assetRefs(item, `${path}[${index}]`));
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "assetId" && typeof child === "string"
      ? [{ assetId: child, path: `${path}.${key}` }]
      : assetRefs(child, `${path}.${key}`),
  );
}

// Kategori ada & cocok untuk component; industri ada.
function checkCategories(
  file: string,
  seed: SeedComponentFile,
  categories: Map<string, { scope: string; type: string }>,
): SeedIssue[] {
  const issues: SeedIssue[] = [];
  const category = categories.get(seed.categorySlug);
  if (!category || category.scope === "template") {
    issues.push({
      file,
      path: "categorySlug",
      message: `kategori component "${seed.categorySlug}" tidak ada di categories.json`,
    });
  }
  seed.meta.industries?.forEach((slug, index) => {
    if (categories.get(slug)?.type !== "industry") {
      issues.push({
        file,
        path: `meta.industries[${index}]`,
        message: `industri "${slug}" tidak ada di categories.json`,
      });
    }
  });
  return issues;
}

// Versi unik & naik; draft hanya satu dan setelah versi published terakhir (CMP-042).
function checkVersions(file: string, seed: SeedComponentFile): SeedIssue[] {
  const issues: SeedIssue[] = [];
  seed.versions.forEach((version, index) => {
    const previous = seed.versions[index - 1];
    if (previous && compareSemver(version.version, previous.version) <= 0) {
      issues.push({
        file,
        path: `versions[${index}].version`,
        message: `versi ${version.version} harus lebih besar dari ${previous.version} (urut naik, unik)`,
      });
    }
  });
  const drafts = seed.versions
    .map((version, index) => ({ version, index }))
    .filter(({ version }) => version.status === "draft");
  for (const { index } of drafts) {
    if (index !== seed.versions.length - 1) {
      issues.push({ file, path: `versions[${index}].status`, message: "draft hanya boleh versi terakhir" });
    }
  }
  return issues;
}

/**
 * Subtree setiap versi harus bisa disisipkan ke website kosong lewat command `insertSubtree` (validasi node penuh,
 * remap ID, batas DM-076) — dry-run di Y.Doc sementara, tidak ada I/O.
 */
function checkSubtrees(file: string, seed: SeedComponentFile, assets: Set<string>): SeedIssue[] {
  const issues: SeedIssue[] = [];
  seed.versions.forEach((version, index) => {
    const base = `versions[${index}].definition.subtree`;
    const { subtree } = version.definition;
    const site = createBlankSiteDocument({ title: "Seed" });
    const pageId = site.pageOrder[0] as string;
    const result = runCommand({ doc: jsonToYDoc(site), origin: userOrigin("library-seed") }, insertSubtree, {
      parentId: pageId,
      subtree,
    });
    if (!result.ok) {
      const tail = (result.error.path ?? []).slice(1);
      issues.push({ file, path: [base, jsonPath(tail)].filter(Boolean).join("."), message: result.error.message.id });
    }

    // CMP-003: root component `section` wajib lebar `fill`.
    if (seed.kind === "section") {
      for (const rootId of subtree.rootIds) {
        const root = subtree.nodes[rootId] as
          | { style?: { base?: { size?: { width?: { mode?: string } } } } }
          | undefined;
        if (root?.style?.base?.size?.width?.mode !== "fill") {
          issues.push({
            file,
            path: `${base}.nodes.${rootId}.style.base.size.width`,
            message: "root section wajib width fill",
          });
        }
      }
    }

    // Asset yang dirujuk wajib tercatat di assets.manifest.json (dengan lisensi).
    for (const ref of assetRefs(subtree.nodes, `${base}.nodes`)) {
      if (!assets.has(ref.assetId)) {
        issues.push({ file, path: ref.path, message: `asset "${ref.assetId}" tidak ada di assets.manifest.json` });
      }
    }
  });
  return issues;
}

export interface SeedLibraryReport {
  issues: SeedIssue[];
  components: { file: string; seed: SeedComponentFile }[];
}

/** Validasi seluruh `data/**` (CMP-143). Tidak melempar: semua masalah dikembalikan di `issues`. */
export function validateSeedLibrary(dataDir = SEED_DATA_DIR): SeedLibraryReport {
  const issues: SeedIssue[] = [];

  const categoriesJson: unknown = JSON.parse(readFileSync(join(dataDir, "categories.json"), "utf8"));
  const categoriesParsed = SeedCategoriesFileSchema.safeParse(categoriesJson);
  if (!categoriesParsed.success) issues.push(...zodIssues("categories.json", categoriesParsed.error));
  const categories = new Map(
    (categoriesParsed.success ? categoriesParsed.data.categories : []).map((category) => [category.slug, category]),
  );

  const manifest = SeedAssetsManifestSchema.safeParse(readAssetsManifest(dataDir));
  if (!manifest.success) issues.push(...zodIssues("assets/assets.manifest.json", manifest.error));
  const assets = new Set((manifest.success ? manifest.data.assets : []).map((asset) => asset.assetId));

  const components: SeedLibraryReport["components"] = [];
  const owners = { id: new Map<string, string>(), slug: new Map<string, string>(), name: new Map<string, string>() };
  for (const { path: file, json } of readComponentFiles(dataDir)) {
    const parsed = SeedComponentFileSchema.safeParse(json);
    if (!parsed.success) {
      issues.push(...zodIssues(file, parsed.error));
      continue;
    }
    const seed = parsed.data;
    // Nama file = slug (kunci stabil, CMP-141).
    if (!file.endsWith(`/${seed.slug}.component.json`)) {
      issues.push({ file, path: "slug", message: `nama file harus "${seed.slug}.component.json"` });
    }
    for (const [key, value] of [
      ["id", seed.id],
      ["slug", seed.slug],
      ["name", seed.meta.name],
    ] as const) {
      const owner = owners[key].get(value);
      if (owner)
        issues.push({
          file,
          path: key === "name" ? "meta.name" : key,
          message: `${key} "${value}" sudah dipakai ${owner}`,
        });
      else owners[key].set(value, file);
    }
    issues.push(
      ...checkCategories(file, seed, categories),
      ...checkVersions(file, seed),
      ...checkSubtrees(file, seed, assets),
    );
    components.push({ file, seed });
  }
  return { issues, components };
}

/** Format laporan untuk CLI/test: `file: path — pesan`. */
export function formatSeedIssues(issues: readonly SeedIssue[]): string {
  return issues.map((issue) => `${issue.file}: ${issue.path || "(root)"} — ${issue.message}`).join("\n");
}
