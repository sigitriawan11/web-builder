import {
  componentFromSubtree,
  createId,
  extractToInstance,
  type Node,
  runCommand,
  yDocToComponentDef,
} from "@platform/document-model";
import type { PlatformApi } from "@platform/sdk";
import type { ComponentKind } from "@platform/shared/contracts";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";

// CMP-011 orchestration (Mode Admin): seleksi → ComponentDefinition draft → API create → ganti seleksi dengan instance
// (version 0 = draft) dalam satu langkah undo. M3: satu node (seleksi >1 → bungkus auto-layout = follow-up).
export interface CreateComponentForm {
  name: string; // PascalCase EN
  displayName: { id: string; en: string };
  kind: ComponentKind;
  categoryId: string;
}

/** slug kebab-case dari nama + sufiks acak (unik per owner). */
export function toComponentSlug(name: string): string {
  const base = name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = createId("cmp").slice(4, 10);
  return `${base || "component"}-${suffix}`;
}

export async function createComponentFromSelection(deps: {
  api: PlatformApi;
  runtime: CanvasRuntime;
  selectedIds: readonly string[];
  form: CreateComponentForm;
}): Promise<{ publicId: string; instanceId: string }> {
  const rootId = deps.selectedIds[0];
  if (deps.selectedIds.length !== 1 || !rootId) {
    throw new Error("Pilih tepat satu node (bungkus-auto-layout untuk seleksi banyak menyusul).");
  }
  // Nodes dokumen draft terbuka (ComponentDefinition Y.Doc) → definisi component baru dari subtree.
  const source = yDocToComponentDef(deps.runtime.doc) as { nodes: Record<string, Node> };
  const definition = componentFromSubtree({ nodes: source.nodes }, rootId, {
    id: createId("cmp"), // placeholder; API meng-generate & menyelaraskan public_id
    name: deps.form.name,
    category: "other",
  });

  const { publicId } = await deps.api.library.createComponent({
    slug: toComponentSlug(deps.form.name),
    categoryId: deps.form.categoryId,
    kind: deps.form.kind,
    name: deps.form.name,
    displayName: deps.form.displayName,
    description: { id: "Dibuat dari seleksi.", en: "Created from selection." },
    definition,
  });

  const result = runCommand({ doc: deps.runtime.doc, origin: deps.runtime.origin }, extractToInstance, {
    rootId,
    componentId: publicId,
    version: 0,
    name: deps.form.name,
  });
  if (!result.ok) throw new Error(`extractToInstance: ${result.error.code}`);
  return { publicId, instanceId: result.value.instanceId };
}
