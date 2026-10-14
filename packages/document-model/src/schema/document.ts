import { z } from "zod";
import { type Node, NodeSchema } from "./nodes";
import { SiteSettingsSchema } from "./settings";
import type { StylePatch } from "./style";
import { ThemeSchema } from "./theme";
import {
  AssetIdSchema,
  CollectionIdSchema,
  ComponentIdSchema,
  NodeIdSchema,
  PageIdSchema,
  TemplateIdSchema,
} from "./values";

// DM-004: info non-visual; TIDAK ada data tenant (userId/workspaceId/domain — DM-001).
export const SiteMetaSchema = z.strictObject({
  title: z.string().min(1),
  createdWith: z.enum(["blank", "template", "ai"]).optional(),
  templateRef: z.strictObject({ templateId: TemplateIdSchema, version: z.number().int().positive() }).optional(),
});

// "Lockfile" component (DM-004, DM-069): setiap instance merujuk versi yang tercatat di sini.
export const ComponentDepSchema = z.strictObject({
  version: z.number().int().positive(),
  source: z.enum(["library", "site", "marketplace"]),
});

// M7: hanya rujukan; schema collection ada di DB (spec 05).
export const DataSourcesSchema = z.strictObject({ collections: z.array(CollectionIdSchema) });

// DM-057: cache ringan metadata asset; URL tidak disimpan di dokumen.
export const AssetEntrySchema = z.strictObject({
  kind: z.enum(["image", "video", "file", "font", "svg"]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mime: z.string().min(1),
  blurhash: z.string().optional(),
  libraryShared: z.boolean().optional(),
});

// Versi schema dokumen yang dihasilkan kode ini (spec 01 §19). Naik bersama fungsi migrasi + fixture test.
export const CURRENT_SCHEMA_VERSION = 1;

// DM-004 top-level. `localComponents` (P1) ditambah bersama fiturnya. Strict: key tak dikenal ditolak.
const SiteDocumentShapeSchema = z.strictObject({
  schemaVersion: z.number().int().positive(),
  meta: SiteMetaSchema,
  settings: SiteSettingsSchema,
  theme: ThemeSchema,
  assets: z.record(AssetIdSchema, AssetEntrySchema),
  componentDeps: z.record(ComponentIdSchema, ComponentDepSchema),
  dataSources: DataSourcesSchema.optional(),
  pageOrder: z.array(PageIdSchema).min(1).max(200),
  nodes: z.record(NodeIdSchema, NodeSchema),
});

type SiteDocumentShape = z.infer<typeof SiteDocumentShapeSchema>;

// Invariant lintas node yang tidak bisa dinyatakan per field (subset DM-069 untuk prototipe).
function checkInvariants(doc: SiteDocumentShape, ctx: z.RefinementCtx): void {
  const report = (path: (string | number)[], message: string) => {
    ctx.addIssue({ code: "custom", path, message });
  };
  const { nodes } = doc;

  for (const [key, node] of Object.entries(nodes)) {
    if (key !== node.id) {
      report(["nodes", key, "id"], `Key "${key}" berbeda dengan node.id "${node.id}"`);
    }
  }

  // DM-006: pageOrder dan node page harus bijeksi.
  const pageOrderSet = new Set<string>();
  doc.pageOrder.forEach((pageId, index) => {
    if (pageOrderSet.has(pageId)) {
      report(["pageOrder", index], `Page "${pageId}" muncul lebih dari sekali`);
    }
    pageOrderSet.add(pageId);
    if (nodes[pageId]?.type !== "page") {
      report(["pageOrder", index], `"${pageId}" bukan node page yang ada di nodes`);
    }
  });

  for (const node of Object.values(nodes)) {
    if (node.type === "page") {
      if (!pageOrderSet.has(node.id)) {
        report(["nodes", node.id], `Page "${node.id}" tidak tercantum di pageOrder`);
      }
      continue;
    }

    // parentId adalah sumber kebenaran relasi; children parent harus mencantumkan node ini.
    const parent = nodes[node.parentId];
    if (!parent || !("children" in parent) || !parent.children.includes(node.id)) {
      report(
        ["nodes", node.id, "parentId"],
        `Parent "${node.parentId}" tidak ada atau tidak mencantumkan "${node.id}" di children`,
      );
    }

    if (node.type === "image") {
      const { assetId } = node.props.image;
      if (!(assetId in doc.assets)) {
        report(["nodes", node.id, "props", "image", "assetId"], `Asset "${assetId}" tidak ada di assets`);
      }
      checkNoHug(node, report);
    }
  }

  // DM-069: aset yang dirujuk settings (favicon, gambar OG default) harus ada di registry.
  const settingsAssets: [string, string | undefined][] = [
    ["favicon", doc.settings.favicon?.assetId],
    ["ogImage", doc.settings.seo.ogImage?.assetId],
  ];
  for (const [field, assetId] of settingsAssets) {
    if (assetId !== undefined && !(assetId in doc.assets)) {
      const path = field === "favicon" ? ["settings", "favicon", "assetId"] : ["settings", "seo", "ogImage", "assetId"];
      report(path, `Asset "${assetId}" tidak ada di assets`);
    }
  }

  const listedChildren = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (!("children" in node)) continue;
    node.children.forEach((childId, index) => {
      const path = ["nodes", node.id, "children", index];
      if (listedChildren.has(childId)) {
        report(path, `Node "${childId}" tercantum lebih dari sekali di children`);
      }
      listedChildren.add(childId);
      const child = nodes[childId];
      if (!child) {
        report(path, `Child "${childId}" tidak ada di nodes`);
      } else if (child.parentId !== node.id) {
        report(path, `Child "${childId}" punya parentId "${String(child.parentId)}", bukan "${node.id}"`);
      }
    });
  }

  // Siklus parent-child bisa lolos cek di atas, jadi pastikan semua node terjangkau dari page.
  const reachable = new Set<string>();
  const stack = doc.pageOrder.filter((pageId) => nodes[pageId]);
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || reachable.has(id)) continue;
    reachable.add(id);
    const node = nodes[id];
    if (node && "children" in node) stack.push(...node.children);
  }
  for (const id of Object.keys(nodes)) {
    if (!reachable.has(id)) {
      report(["nodes", id], `Node "${id}" tidak terhubung ke page mana pun`);
    }
  }
}

// DM-027: `hug` hanya untuk container & text; image harus fixed/fill.
function checkNoHug(
  node: Extract<Node, { type: "image" }>,
  report: (path: (string | number)[], message: string) => void,
): void {
  const layers: [string, StylePatch | undefined][] = [
    ["base", node.style.base],
    ["tablet", node.style.tablet],
    ["mobile", node.style.mobile],
  ];
  for (const [breakpoint, style] of layers) {
    for (const axis of ["width", "height"] as const) {
      if (style?.size?.[axis]?.mode === "hug") {
        report(["nodes", node.id, "style", breakpoint, "size", axis], `Image tidak boleh memakai ukuran "hug"`);
      }
    }
  }
}

export const SiteDocumentSchema = SiteDocumentShapeSchema.superRefine(checkInvariants);

export type SiteMeta = z.infer<typeof SiteMetaSchema>;
export type AssetEntry = z.infer<typeof AssetEntrySchema>;
export type ComponentDep = z.infer<typeof ComponentDepSchema>;
export type DataSources = z.infer<typeof DataSourcesSchema>;
export type SiteDocument = z.infer<typeof SiteDocumentSchema>;
