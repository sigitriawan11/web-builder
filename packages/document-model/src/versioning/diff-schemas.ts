import type { ComponentDefinition, PropDef, VariantAxis } from "../schema/component";

// CMP-042: deteksi jenis bump (MAJOR/MINOR/PATCH) dengan membandingkan dua ComponentDefinition. Fungsi murni →
// unit-testable per baris tabel spec. Catatan: aturan "ID node ber-override di situs dihapus → MAJOR" butuh data
// situs; di sini node dihapus diperlakukan MAJOR secara konservatif (override tak diketahui dari schema saja).

export type Bump = "major" | "minor" | "patch";
const SEVERITY: Record<Bump, number> = { patch: 0, minor: 1, major: 2 };

export interface SchemaChange {
  kind:
    | "prop-removed"
    | "prop-added"
    | "prop-type-changed"
    | "prop-required-added"
    | "enum-option-removed"
    | "enum-option-added"
    | "axis-removed"
    | "axis-added"
    | "axis-option-removed"
    | "axis-option-added"
    | "node-removed"
    | "node-added";
  key: string;
  bump: Bump;
}

export interface SchemaDiff {
  bump: Bump;
  changes: SchemaChange[];
}

const byKey = <T extends { key?: string; name?: string }>(items: readonly T[], field: "key" | "name"): Map<string, T> =>
  new Map(items.map((item) => [String(item[field]), item]));

// Default "ada" (prop tak breaking saat jadi required). Tipe tanpa field `default` (image/link/slot) → opsional.
function hasDefault(prop: PropDef): boolean {
  return "default" in prop && (prop as { default?: unknown }).default !== undefined;
}

function enumOptions(prop: PropDef): Set<string> {
  return prop.type === "enum" ? new Set(prop.options.map((o) => o.value)) : new Set();
}

function diffProps(prev: readonly PropDef[], next: readonly PropDef[], changes: SchemaChange[]): void {
  const prevMap = byKey(prev, "key");
  const nextMap = byKey(next, "key");
  for (const [key, prevProp] of prevMap) {
    const nextProp = nextMap.get(key);
    if (!nextProp) {
      changes.push({ kind: "prop-removed", key, bump: "major" });
      continue;
    }
    if (prevProp.type !== nextProp.type) {
      changes.push({ kind: "prop-type-changed", key, bump: "major" });
      continue; // tipe beda → perbandingan enum/required tak relevan.
    }
    if (!prevProp.required && nextProp.required && !hasDefault(nextProp))
      changes.push({ kind: "prop-required-added", key, bump: "major" });
    const prevOpts = enumOptions(prevProp);
    const nextOpts = enumOptions(nextProp);
    for (const opt of prevOpts)
      if (!nextOpts.has(opt)) changes.push({ kind: "enum-option-removed", key, bump: "major" });
    for (const opt of nextOpts) if (!prevOpts.has(opt)) changes.push({ kind: "enum-option-added", key, bump: "minor" });
  }
  for (const key of nextMap.keys()) if (!prevMap.has(key)) changes.push({ kind: "prop-added", key, bump: "minor" });
}

function diffAxes(prev: readonly VariantAxis[], next: readonly VariantAxis[], changes: SchemaChange[]): void {
  const prevMap = byKey(prev, "name");
  const nextMap = byKey(next, "name");
  for (const [name, prevAxis] of prevMap) {
    const nextAxis = nextMap.get(name);
    if (!nextAxis) {
      changes.push({ kind: "axis-removed", key: name, bump: "major" });
      continue;
    }
    const prevOpts = new Set(prevAxis.options);
    const nextOpts = new Set(nextAxis.options);
    for (const opt of prevOpts)
      if (!nextOpts.has(opt)) changes.push({ kind: "axis-option-removed", key: name, bump: "major" });
    for (const opt of nextOpts)
      if (!prevOpts.has(opt)) changes.push({ kind: "axis-option-added", key: name, bump: "minor" });
  }
  for (const name of nextMap.keys())
    if (!prevMap.has(name)) changes.push({ kind: "axis-added", key: name, bump: "minor" });
}

function diffNodes(prev: ComponentDefinition, next: ComponentDefinition, changes: SchemaChange[]): void {
  const prevIds = new Set(Object.keys(prev.nodes));
  const nextIds = new Set(Object.keys(next.nodes));
  for (const id of prevIds) if (!nextIds.has(id)) changes.push({ kind: "node-removed", key: id, bump: "major" });
  for (const id of nextIds) if (!prevIds.has(id)) changes.push({ kind: "node-added", key: id, bump: "minor" });
}

/** CMP-042: bandingkan schema dua versi → bump wajib + daftar perubahan. Tanpa perubahan schema → PATCH. */
export function diffComponentSchemas(prev: ComponentDefinition, next: ComponentDefinition): SchemaDiff {
  const changes: SchemaChange[] = [];
  diffProps(prev.propsSchema as PropDef[], next.propsSchema as PropDef[], changes);
  diffAxes(prev.variantAxes ?? [], next.variantAxes ?? [], changes);
  diffNodes(prev, next, changes);
  const bump = changes.reduce<Bump>((acc, c) => (SEVERITY[c.bump] > SEVERITY[acc] ? c.bump : acc), "patch");
  return { bump, changes };
}
