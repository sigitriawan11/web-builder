import { walk } from "../query/tree";
import type { Node, SiteDocument } from "../schema";
import {
  type ComponentCategory,
  type ComponentDefinition,
  CURRENT_COMPONENT_SCHEMA_VERSION,
} from "../schema/component";
import { cloneJson } from "../yjs/clone-json";

// CMP-011: bangun ComponentDefinition draft dari subtree sebuah dokumen (Mode Admin "Create component from selection").
// Kebalikan dari `detachToSubtree`. ID node DIPERTAHANKAN (DM-045: stabil antar versi, dipakai binding props/override).
// Hanya menangani SATU root; bila seleksi >1 node, pemanggil (editor) membungkusnya dalam frame auto-layout dulu.

export interface ComponentMeta {
  id: string; // `cmp_…` (public id)
  name: string; // PascalCase EN
  category: ComponentCategory;
}

/** Subtree `rootId` → ComponentDefinition `v0-draft`. Root jadi `parentId: null`; propsSchema kosong (binding = T3.4.5). */
export function componentFromSubtree(
  doc: Pick<SiteDocument, "nodes">,
  rootId: string,
  meta: ComponentMeta,
): ComponentDefinition {
  const root = doc.nodes[rootId];
  if (!root) throw new Error(`componentFromSubtree: rootId "${rootId}" tidak ada`);

  const nodes: Record<string, unknown> = {};
  // walk: root di depth 0, lalu seluruh descendant (urutan DOM). parentId descendant tetap (menunjuk di dalam subtree).
  walk(doc, rootId, ({ node }: { node: Node }) => {
    const copy = cloneJson(node) as Record<string, unknown>;
    if (node.id === rootId) copy.parentId = null; // root component: tanpa parent
    nodes[node.id] = copy;
  });

  return {
    schemaVersion: CURRENT_COMPONENT_SCHEMA_VERSION,
    id: meta.id,
    version: 1,
    name: meta.name,
    category: meta.category,
    propsSchema: [],
    rootId,
    nodes,
  } as ComponentDefinition;
}
