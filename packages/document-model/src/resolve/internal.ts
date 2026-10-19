import { patchBreakpoint } from "../commands/update-style";
import type { ComponentDefinition, NodePatch, PropDef, ResponsiveStyle } from "../schema";
import { isPropRef } from "../schema/values";

// Helper resolusi component bersama (resolveInstance & detach). Murni, tanpa I/O.

export type Props = Record<string, unknown>;
export type Variant = Record<string, string>;

export const defaultsOfProps = (propsSchema: readonly PropDef[]): Props => {
  const props: Props = {};
  for (const prop of propsSchema) if ("default" in prop && prop.default !== undefined) props[prop.key] = prop.default;
  return props;
};

export const defaultsOfVariant = (axes: ComponentDefinition["variantAxes"]): Variant =>
  Object.fromEntries((axes ?? []).map((axis) => [axis.name, axis.default]));

export const sanitizeVariant = (variant: Variant | undefined, def: ComponentDefinition): Variant => {
  const out: Variant = {};
  const byName = new Map((def.variantAxes ?? []).map((axis) => [axis.name, new Set(axis.options)]));
  for (const [name, option] of Object.entries(variant ?? {})) if (byName.get(name)?.has(option)) out[name] = option;
  return out;
};

export const pickKnownProps = (values: Props | undefined, propsSchema: readonly PropDef[]): Props => {
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
export function collectPatches(
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

export function applyPatch(
  node: Record<string, unknown>,
  patches: readonly NodePatch[] | undefined,
): Record<string, unknown> {
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
export function substitute(value: unknown, props: Props): unknown {
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

export const extractNested = (patches: Map<string, NodePatch[]>, prefix: string): Record<string, NodePatch> => {
  const nested: Record<string, NodePatch> = {};
  for (const [path, list] of patches)
    if (path.startsWith(prefix)) for (const patch of list) nested[path.slice(prefix.length)] = patch;
  return nested;
};
