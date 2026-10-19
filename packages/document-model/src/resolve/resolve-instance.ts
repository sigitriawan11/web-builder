import { plainToRichText } from "../commands/content";
import { patchBreakpoint } from "../commands/update-style";
import type { ComponentDefinition, Node, NodePatch, PropDef, ResponsiveStyle, StylePatch } from "../schema";
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

// DM-051: resolusi instance → subtree node biasa untuk renderer/AI/detach. Murni & deterministik.
// Prioritas (rendah→tinggi): definisi base → variant rules → propValues ($prop) → overrides instance → states.

export const MAX_INSTANCE_DEPTH = 8;

export interface ResolvedNode {
  id: string;
  type: Node["type"];
  tag?: string;
  name: string;
  visible: boolean;
  locked: boolean;
  style: ResponsiveStyle;
  props?: Record<string, unknown>;
  a11y?: unknown;
  htmlId?: string;
  metadata?: unknown;
  children?: ResolvedNode[];
  // Instance asal (editor: klik → pilih instance). Root hasil resolve membawanya.
  sourceInstanceId?: string;
  // Diisi bila component/versi tidak ditemukan → renderer tampilkan placeholder.
  missingComponent?: { componentId: string; version: number };
}

export interface ResolveCtx {
  getComponent(componentId: string, version: number): ComponentDefinition | undefined;
  // Node site (untuk isi slot yang menunjuk node milik dokumen site).
  siteNode(id: string): Node | undefined;
  onWarning?(code: string, detail: string): void;
}

/** Resolusi satu instance node → ResolvedNode. `ctx.getComponent` wajib mengembalikan versi ter-pin. */
export function resolveInstance(inst: Node & { type: "instance" }, ctx: ResolveCtx, depth = 0): ResolvedNode {
  const { componentId, version } = inst.props;
  if (depth > MAX_INSTANCE_DEPTH) {
    ctx.onWarning?.("INSTANCE_DEPTH", `${componentId}@${version} melebihi kedalaman ${MAX_INSTANCE_DEPTH}`);
    return {
      id: inst.id,
      type: "frame",
      name: inst.name,
      visible: inst.visible,
      locked: inst.locked,
      style: inst.style,
      sourceInstanceId: inst.id,
    };
  }
  const def = ctx.getComponent(componentId, version);
  if (!def) {
    ctx.onWarning?.("MISSING_COMPONENT", `${componentId}@${version}`);
    return {
      id: inst.id,
      type: "frame",
      name: inst.name,
      visible: inst.visible,
      locked: inst.locked,
      style: inst.style,
      sourceInstanceId: inst.id,
      missingComponent: { componentId, version },
    };
  }

  // `propsSchema`/`overrides` di-infer longgar (PropDefSchema = z.ZodType) → dipersempit di sini.
  const propsSchema = def.propsSchema as PropDef[];
  const variant = { ...defaultsOfVariant(def.variantAxes), ...sanitizeVariant(inst.props.variant, def) };
  const props = { ...defaultsOfProps(propsSchema), ...pickKnownProps(inst.props.propValues, propsSchema) };
  const patches = collectPatches(def, variant, inst.props.overrides as Record<string, NodePatch> | undefined);

  const walk = (defNodeId: string): ResolvedNode => {
    const src = def.nodes[defNodeId];
    if (!src || typeof src !== "object") {
      return {
        id: `${inst.id}:${defNodeId}`,
        type: "frame",
        name: defNodeId,
        visible: true,
        locked: false,
        style: { base: {} },
      };
    }
    const scopedId = `${inst.id}:${defNodeId}`;
    const patched = applyPatch(cloneJson(src) as Record<string, unknown>, patches.get(defNodeId));
    // Node ComponentDefinition boleh bertipe `slot` (di luar union `Node` site), jadi `type` dilonggarkan ke string.
    const node = substitute(patched, props) as Record<string, unknown> & {
      type: string;
      children?: string[];
      props?: Record<string, unknown>;
    };

    if (node.type === "slot") {
      const slotName = (node.props as { slotName?: string } | undefined)?.slotName ?? "";
      const fill = inst.props.slots?.[slotName];
      const children = fill?.length
        ? fill.flatMap((id) => {
            const sn = ctx.siteNode(id);
            return sn ? [resolveSiteNode(sn, ctx, depth + 1)] : [];
          })
        : (node.children ?? []).map(walk);
      return finalize(scopedId, { ...node, type: "frame" }, children);
    }
    if (node.type === "instance") {
      const nested = extractNested(patches, `${defNodeId}/`);
      const mergedOverrides = { ...(node.props?.overrides as Record<string, NodePatch> | undefined), ...nested };
      const nestedInst = {
        ...node,
        id: scopedId,
        props: { ...node.props, overrides: mergedOverrides },
      } as unknown as Node & { type: "instance" };
      return resolveInstance(nestedInst, ctx, depth + 1);
    }
    const children = "children" in node && Array.isArray(node.children) ? node.children.map(walk) : undefined;
    return finalize(scopedId, node, children);
  };

  const root = walk(def.rootId);
  // Style instance (size/position di parent) di-merge ke style root definisi.
  root.style = mergeRootStyle(root.style, inst.style);
  root.sourceInstanceId = inst.id;
  return root;
}

/** Resolusi node site (untuk top-level & isi slot): instance → resolveInstance; lainnya rekursi anak. */
export function resolveSiteNode(node: Node, ctx: ResolveCtx, depth = 0): ResolvedNode {
  if (node.type === "instance") return resolveInstance(node, ctx, depth);
  const children =
    "children" in node
      ? node.children.flatMap((id) => {
          const child = ctx.siteNode(id);
          return child ? [resolveSiteNode(child, ctx, depth)] : [];
        })
      : undefined;
  return finalize(node.id, node as unknown as Record<string, unknown>, children);
}

function finalize(id: string, node: Record<string, unknown>, children: ResolvedNode[] | undefined): ResolvedNode {
  let props = node.props as Record<string, unknown> | undefined;
  // DM-047: prop text terikat ke `content` masuk sebagai string → jadi satu paragraf.
  if (node.type === "text" && props && typeof props.content === "string") {
    props = { ...props, content: plainToRichText(props.content) };
  }
  return {
    id,
    type: node.type as Node["type"],
    ...(typeof node.tag === "string" ? { tag: node.tag } : {}),
    name: (node.name as string) ?? "",
    visible: node.visible !== false,
    locked: node.locked === true,
    style: (node.style as ResponsiveStyle) ?? { base: {} },
    ...(props ? { props } : {}),
    ...(node.a11y ? { a11y: node.a11y } : {}),
    ...(typeof node.htmlId === "string" ? { htmlId: node.htmlId } : {}),
    ...(node.metadata ? { metadata: node.metadata } : {}),
    ...(children ? { children } : {}),
  };
}

function mergeRootStyle(defStyle: ResponsiveStyle, instStyle: ResponsiveStyle): ResponsiveStyle {
  let merged = defStyle;
  for (const bp of ["base", "tablet", "mobile"] as const) {
    const patch = instStyle[bp];
    if (patch) merged = patchBreakpoint(merged, bp, patch as StylePatch);
  }
  return merged;
}
