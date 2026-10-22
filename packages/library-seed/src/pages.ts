import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { readComponentFiles, SeedComponentFileSchema } from "./component";
import { SEED_DATA_DIR, SEED_DIRS } from "./paths";

// T3.12.1 (CMP-080) — Dogfooding: halaman contoh disusun HANYA dari component published.
// Model template penuh (instance + binding) = epic terpisah; di sini halaman = daftar blok (slug component)
// yang di-stack di bawah satu root. Audit mengukur "node bebas" (= shell halaman) < 10% dari total node.
// Blok yang tidak ter-resolve atau belum published dicatat sebagai gap (T3.12.2).

const SlugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug kebab-case");
const LocalizedSchema = z.strictObject({ id: z.string().min(1), en: z.string().min(1) });

export const SeedPageSchema = z.strictObject({
  $schema: z.string().optional(),
  seedVersion: z.literal(1),
  slug: SlugSchema,
  categorySlug: SlugSchema,
  displayName: LocalizedSchema,
  description: z.strictObject({ id: z.string().min(30).max(500), en: z.string().min(30).max(500) }),
  // Urutan blok dari atas ke bawah; tiap entri = slug component published.
  blocks: z.array(SlugSchema).min(3),
});
export type SeedPage = z.infer<typeof SeedPageSchema>;

export interface SeedPageFile {
  path: string;
  json: unknown;
}

/** Semua file `*.page.json` di bawah `data/templates/` (urut path agar deterministik). */
export function readPageFiles(dataDir = SEED_DATA_DIR): SeedPageFile[] {
  const root = join(dataDir, SEED_DIRS.templates);
  const files = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".page.json"))
    .map((entry) => join(root, entry.name))
    .sort();
  return files.map((file) => ({
    path: relative(dataDir, file),
    json: JSON.parse(readFileSync(file, "utf8")) as unknown,
  }));
}

interface PublishedComponent {
  nodeCount: number;
}

/** Peta slug → component published (versi published terakhir) + jumlah node subtree-nya. */
function publishedComponents(dataDir = SEED_DATA_DIR): Map<string, PublishedComponent> {
  const map = new Map<string, PublishedComponent>();
  for (const { json } of readComponentFiles(dataDir)) {
    const parsed = SeedComponentFileSchema.safeParse(json);
    if (!parsed.success) continue;
    const latest = parsed.data.versions.filter((version) => version.status === "published").at(-1);
    if (!latest) continue;
    map.set(parsed.data.slug, { nodeCount: Object.keys(latest.definition.subtree.nodes).length });
  }
  return map;
}

export interface PageAudit {
  path: string;
  slug: string;
  blockCount: number;
  componentNodes: number;
  freeNodes: number;
  totalNodes: number;
  /** Rasio node bebas (shell halaman) terhadap total. AC CMP-093: < 0.10. */
  freeRatio: number;
  /** Blok yang slug-nya tidak ada / belum published (gap library — T3.12.2). */
  missingBlocks: string[];
  issues: string[];
}

// Shell halaman = 1 root frame yang men-stack blok. Inilah satu-satunya "node bebas" (bukan dari component).
const PAGE_SHELL_NODES = 1;

export function auditPages(dataDir = SEED_DATA_DIR): PageAudit[] {
  const published = publishedComponents(dataDir);
  return readPageFiles(dataDir).map(({ path, json }) => {
    const issues: string[] = [];
    const parsed = SeedPageSchema.safeParse(json);
    if (!parsed.success) {
      return {
        path,
        slug: "?",
        blockCount: 0,
        componentNodes: 0,
        freeNodes: 0,
        totalNodes: 0,
        freeRatio: 1,
        missingBlocks: [],
        issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      };
    }
    const page = parsed.data;
    const missingBlocks: string[] = [];
    let componentNodes = 0;
    for (const slug of page.blocks) {
      const component = published.get(slug);
      if (!component) missingBlocks.push(slug);
      else componentNodes += component.nodeCount;
    }
    const freeNodes = PAGE_SHELL_NODES;
    const totalNodes = componentNodes + freeNodes;
    const freeRatio = totalNodes === 0 ? 1 : freeNodes / totalNodes;
    if (missingBlocks.length > 0) issues.push(`blok tidak published/ada: ${missingBlocks.join(", ")}`);
    return {
      path,
      slug: page.slug,
      blockCount: page.blocks.length,
      componentNodes,
      freeNodes,
      totalNodes,
      freeRatio,
      missingBlocks,
      issues,
    };
  });
}
