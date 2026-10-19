import { plainToRichText } from "../commands/content";
import { patchBreakpoint } from "../commands/update-style";
import { createId } from "../ids";
import type { ComponentDefinition, Node, PropDef, ResponsiveStyle, StylePatch } from "../schema";
import { cloneJson } from "../yjs/clone-json";
import {
  applyPatch,
  collectPatches,
  defaultsOfProps,
  defaultsOfVariant,
  extractNested,
  pickKnownProps,
  sanitizeVariant,
  substitute,
} from "./internal";

// DM-050: detach SATU level. Definisi instance → subtree node biasa (ID baru, $prop→literal, variant+override
// diterapkan). Instance bersarang TETAP instance. Isi slot (node site) dipindah ke posisi slot. Pure.

type JsonNode = Record<string, unknown>;

export interface DetachResult {
  rootId: string;
  // Node baru (ID baru) hasil detach, siap dimasukkan ke dokumen.
  nodes: Record<string, Node>;
  // Konten slot (node site yang sudah ada) yang dipindah: id lama → parent baru (frame slot) + urutan.
  moved: { nodeId: string; parentId: string; index: number }[];
  // Dependency component dari instance bersarang yang jadi node site nyata (DM-069) — caller catat componentDeps.
  deps: Record<string, number>;
}

function mergeRootStyle(defStyle: ResponsiveStyle, instStyle: ResponsiveStyle): ResponsiveStyle {
  let merged = defStyle;
  for (const bp of ["base", "tablet", "mobile"] as const) {
    const patch = instStyle[bp];
    if (patch) merged = patchBreakpoint(merged, bp, patch as StylePatch);
  }
  return merged;
}

/** Resolusi detach satu level. `idGen` default `createId`. */
export function detachToSubtree(
  inst: Node & { type: "instance" },
  def: ComponentDefinition,
  idGen: (prefix: "n") => string = createId,
): DetachResult {
  const propsSchema = def.propsSchema as PropDef[];
  const variant = { ...defaultsOfVariant(def.variantAxes), ...sanitizeVariant(inst.props.variant, def) };
  const props = { ...defaultsOfProps(propsSchema), ...pickKnownProps(inst.props.propValues, propsSchema) };
  const patches = collectPatches(def, variant, inst.props.overrides as never);

  const nodes: Record<string, Node> = {};
  const moved: DetachResult["moved"] = [];
  const deps: Record<string, number> = {};

  const walk = (defNodeId: string, parentId: string): string => {
    const newId = idGen("n");
    const patched = applyPatch(cloneJson(def.nodes[defNodeId]) as JsonNode, patches.get(defNodeId));
    const node = substitute(patched, props) as JsonNode & { type: string; children?: string[]; props?: JsonNode };
    node.id = newId;
    node.parentId = parentId;

    if (node.type === "slot") {
      // Slot → frame non-semantik. Isi: node site yang di-fill (dipindah) atau isi default (di-walk).
      const slotName = (node.props?.slotName as string) ?? "";
      const fill = inst.props.slots?.[slotName];
      const frame: JsonNode = {
        id: newId,
        type: "frame",
        name: node.name,
        parentId,
        visible: node.visible,
        locked: node.locked,
        tag: "div",
        style: node.style,
        props: {},
        children: [] as string[],
      };
      if (fill?.length) {
        frame.children = [...fill];
        fill.forEach((siteId, index) => {
          moved.push({ nodeId: siteId, parentId: newId, index });
        });
      } else {
        frame.children = (node.children ?? []).map((child) => walk(child, newId));
      }
      nodes[newId] = frame as unknown as Node;
      return newId;
    }

    if (node.type === "instance") {
      // Instance bersarang tetap instance; gabung override yang menembus; catat dependency.
      const nested = { ...(node.props?.overrides as object), ...extractNested(patches, `${defNodeId}/`) };
      node.props = { ...node.props, ...(Object.keys(nested).length ? { overrides: nested } : {}) };
      const componentId = node.props?.componentId as string;
      const version = node.props?.version as number;
      if (componentId && typeof version === "number") deps[componentId] = version;
      nodes[newId] = node as unknown as Node;
      return newId;
    }

    if (Array.isArray(node.children)) node.children = node.children.map((child) => walk(child, newId));
    if (node.type === "text" && typeof node.props?.content === "string") {
      node.props = { ...node.props, content: plainToRichText(node.props.content) };
    }
    nodes[newId] = node as unknown as Node;
    return newId;
  };

  const rootId = walk(def.rootId, inst.parentId as string);
  const root = nodes[rootId] as unknown as JsonNode;
  root.style = mergeRootStyle(root.style as ResponsiveStyle, inst.style);
  root.metadata = {
    ...(root.metadata as object),
    detachedFrom: { componentId: inst.props.componentId, version: inst.props.version },
  };
  return { rootId, nodes, moved, deps };
}
