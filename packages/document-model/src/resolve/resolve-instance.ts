import { plainToRichText } from "../commands/content";
import { patchBreakpoint } from "../commands/update-style";
import type { ComponentDefinition, Node, NodePatch, PropDef, ResponsiveStyle, StylePatch } from "../schema";
import { isPropRef } from "../schema/values";
import { cloneJson } from "../yjs/clone-json";

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

type Props = Record<string, unknown>;
type Variant = Record<string, string>;

const defaultsOfProps = (propsSchema: readonly PropDef[]): Props => {
  const props: Props = {};
  for (const prop of propsSchema) if ("default" in prop && prop.default !== undefined) props[prop.key] = prop.default;
  return props;
};

const defaultsOfVariant = (axes: ComponentDefinition["variantAxes"]): Variant =>
  Object.fromEntries((axes ?? []).map((axis) => [axis.name, axis.default]));

const sanitizeVariant = (variant: Variant | undefined, def: ComponentDefinition): Variant => {
  const out: Variant = {};
  const byName = new Map((def.variantAxes ?? []).map((axis) => [axis.name, new Set(axis.options)]));
  for (const [name, option] of Object.entries(variant ?? {})) if (byName.get(name)?.has(option)) out[name] = option;
  return out;
};

const pickKnownProps = (values: Props | undefined, propsSchema: readonly PropDef[]): Props => {
  const keys = new Set(propsSchema.map((prop) => prop.key));
  return Object.fromEntries(Object.entries(values ?? {}).filter(([key]) => keys.has(key)));
};

// Variant rules spesifik (lebih banyak key di `when`) diterapkan setelah yang umum (DM-048), stable.
const sortBySpecificity = <T extends { when: Record<string, string> }>(rules: readonly T[]): T[] =>
  rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => Object.keys(a.rule.when).length - Object.keys(b.rule.when).length || a.index - b.index)
    .map((x) => x.rule);

const matches = (when: Record<string, string>, variant: Variant): boolean =>
  Object.entries(when).every(([name, option]) => variant[name] === option);

// Kumpulkan patch per NodePath: variant rules (urut spesifisitas) lalu override instance (prioritas tertinggi).
function collectPatches(
  def: ComponentDefinition,
  variant: Variant,
  overrides: Record<string, NodePatch> | undefined,
): Map<string, NodePatch[]> {
  const patches = new Map<string, NodePatch[]>();
  const add = (map: Record<string, NodePatch>) => {
    for (const [path, patch] of Object.entries(map)) patches.set(path, [...(patches.get(path) ?? []), patch]);
  };
  for (const rule of sortBySpecificity(def.variants ?? [])) if (matches(rule.when, variant)) add(rule.overrides);
  if (overrides) add(overrides);
  return patches;
}

function applyPatch(node: Record<string, unknown>, patches: readonly NodePatch[] | undefined): Record<string, unknown> {
  if (!patches?.length) return node;
  let style = node.style as ResponsiveStyle;
  let props = (node.props as Props | undefined) ?? undefined;
  let visible = node.visible as boolean;
  for (const patch of patches) {
    for (const bp of ["base", "tablet", "mobile"] as const) {
      const bpPatch = patch.style?.[bp];
      if (bpPatch) style = patchBreakpoint(style, bp, bpPatch);
    }
    if (patch.props) props = { ...(props ?? {}), ...patch.props };
    if (patch.visible !== undefined) visible = patch.visible;
  }
  return { ...node, style, ...(props ? { props } : {}), visible };
}

// Ganti `{$prop}` dengan nilai props (deep). `eq` → boolean; `fallback` bila prop kosong. Scope item list (M7)
// belum didukung: ref `menuItems[].x` memakai key dasar.
function substitute(value: unknown, props: Props): unknown {
  if (Array.isArray(value)) return value.map((item) => substitute(item, props));
  if (value && typeof value === "object") {
    if (isPropRef(value)) {
      const ref = value as { $prop: string; eq?: unknown; fallback?: unknown };
      const raw = props[ref.$prop.split(/[.[]/)[0] ?? ref.$prop];
      if (ref.eq !== undefined) return raw === ref.eq;
      return raw ?? ref.fallback ?? null;
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = substitute(item, props);
    return out;
  }
  return value;
}

const extractNested = (patches: Map<string, NodePatch[]>, prefix: string): Record<string, NodePatch> => {
  const nested: Record<string, NodePatch> = {};
  for (const [path, list] of patches)
    if (path.startsWith(prefix)) for (const patch of list) nested[path.slice(prefix.length)] = patch;
  return nested;
};

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
