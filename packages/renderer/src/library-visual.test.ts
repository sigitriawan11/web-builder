import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ComponentDefinition, CURRENT_COMPONENT_SCHEMA_VERSION } from "@platform/document-model";
import { describe, expect, it } from "vitest";
import { renderComponentPreview } from "./static/component-preview";

// T3.2.4 (CMP-080, ARCHITECTURE §14): regresi visual per component library. Setiap component published dirender ke
// HTML + CSS (CSS memuat media-query untuk KETIGA breakpoint sekaligus → satu snapshot meng-cover base/tablet/mobile).
// Snapshot deterministik (tanpa browser/font/ikon-flaky) menjaga output renderer stabil; baseline piksel Playwright
// `toHaveScreenshot` (fidelitas font/ikon penuh) = follow-up (lihat catatan ROADMAP T3.2.4).

interface SeedFile {
  id: string;
  slug: string;
  categorySlug: string;
  meta: { name: string };
  versions: { status: string; definition: { subtree: { rootIds: string[]; nodes: Record<string, unknown> } } }[];
}

const DATA_DIR = fileURLToPath(new URL("../../library-seed/data/components/", import.meta.url));

function readSeedComponents(): SeedFile[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".component.json")) files.push(full);
    }
  };
  walk(DATA_DIR);
  return files.sort().map((file) => JSON.parse(readFileSync(file, "utf8")) as SeedFile);
}

/** Subtree seed (format M1) → ComponentDefinition minimal yang bisa dirender. Multi-root dibungkus satu frame kolom. */
function toDefinition(file: SeedFile): ComponentDefinition {
  const version = file.versions.find((v) => v.status === "published") ?? file.versions.at(-1);
  if (!version) throw new Error(`${file.slug}: tanpa versi`);
  const subtree = version.definition.subtree;
  const nodes: Record<string, unknown> = { ...subtree.nodes };
  let rootId: string;
  if (subtree.rootIds.length === 1) {
    rootId = subtree.rootIds[0] as string;
    nodes[rootId] = { ...(nodes[rootId] as object), parentId: null };
  } else {
    rootId = "tmp_previewroot";
    nodes[rootId] = {
      id: rootId,
      type: "frame",
      name: "Preview",
      parentId: null,
      visible: true,
      locked: false,
      children: subtree.rootIds,
      style: {
        base: {
          layout: { mode: "flex", direction: "column" },
          size: { width: { mode: "fill" }, height: { mode: "hug" } },
        },
      },
      props: {},
    };
    for (const r of subtree.rootIds) nodes[r] = { ...(nodes[r] as object), parentId: rootId };
  }
  return {
    schemaVersion: CURRENT_COMPONENT_SCHEMA_VERSION,
    id: file.id,
    version: 1,
    name: file.meta.name,
    category: "card",
    propsSchema: [],
    rootId,
    nodes,
  } as unknown as ComponentDefinition;
}

const components = readSeedComponents();

describe("regresi visual library (T3.2.4)", () => {
  it("ada komponen untuk di-regresi", () => {
    expect(components.length).toBeGreaterThanOrEqual(85);
  });

  it.each(components.map((c) => [`${c.categorySlug}/${c.slug}`, c] as const))(
    "render stabil: %s",
    async (key, file) => {
      const page = renderComponentPreview(toDefinition(file), { assetUrl: () => "" });
      const slug = key.replace("/", "__");
      await expect(`${page.html}\n\n/* --- CSS --- */\n${page.css}`).toMatchFileSnapshot(
        `./__snapshots__/library/${slug}.html`,
      );
    },
  );
});
