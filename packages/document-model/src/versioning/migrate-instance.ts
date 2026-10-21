import { z } from "zod";
import { PropValueSchema } from "../schema/component";
import type { InstanceProps } from "../schema/nodes";
import { NodeIdSchema } from "../schema/values";

// CMP-054/DM-079: migrasi propValues/variant/overrides/slots instance saat component naik versi MAJOR. Operasi
// terdaftar (bukan kode bebas): rename/mapValues/moveInto/setDefault/drop/transform. Berantai (1→2→3) dengan
// menjalankan migrasi berurutan. Fungsi murni & ber-unit test.

const Label = z.strictObject({ id: z.string(), en: z.string() });
const TRANSFORMS = ["stringToRichText", "richTextToString", "linkUrlToLinkValue"] as const;

const PropOpSchema = z.union([
  z.strictObject({ rename: z.string().min(1) }),
  z.strictObject({ mapValues: z.record(z.string(), z.string()) }),
  z.strictObject({ moveInto: z.string().min(1) }),
  z.strictObject({ setDefault: PropValueSchema }),
  z.strictObject({ drop: z.literal(true), note: Label.optional() }),
  z.strictObject({ transform: z.enum(TRANSFORMS) }),
]);

export const ComponentMigrationSchema = z.strictObject({
  fromMajor: z.number().int().nonnegative(),
  props: z.record(z.string(), PropOpSchema).optional(),
  variants: z
    .record(
      z.string(),
      z.strictObject({ rename: z.string().optional(), mapValues: z.record(z.string(), z.string()).optional() }),
    )
    .optional(),
  nodeIds: z.record(NodeIdSchema, NodeIdSchema).optional(),
  slots: z.record(z.string(), z.string()).optional(),
});
export type ComponentMigration = z.infer<typeof ComponentMigrationSchema>;

export interface MigrationWarning {
  propKey: string;
  note?: { id: string; en: string };
  previousValue: unknown;
}

export interface MigrateResult {
  props: InstanceProps;
  warnings: MigrationWarning[];
}

type Dict = Record<string, unknown>;

function applyTransform(name: (typeof TRANSFORMS)[number], value: unknown): unknown {
  switch (name) {
    case "stringToRichText": {
      const text = value == null ? "" : String(value);
      return { type: "doc", content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] };
    }
    case "richTextToString": {
      const parts: string[] = [];
      const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        const n = node as { text?: unknown; content?: unknown };
        if (typeof n.text === "string") parts.push(n.text);
        if (Array.isArray(n.content)) for (const child of n.content) walk(child);
      };
      walk(value);
      return parts.join("");
    }
    case "linkUrlToLinkValue":
      return { type: "url", url: value == null ? "" : String(value) };
  }
}

// Set nilai ke path titik (`primaryCta.label`) di dalam `target`, membuat objek antara bila perlu.
function setDeep(target: Dict, path: string, value: unknown): void {
  const keys = path.split(".");
  let cursor = target;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i] as string;
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) cursor[key] = {};
    cursor = cursor[key] as Dict;
  }
  cursor[keys[keys.length - 1] as string] = value;
}

// Remap setiap segmen NodePath (`a/b/c`) via `nodeIds` (ID lama → baru).
const remapPath = (path: string, nodeIds: Record<string, string>): string =>
  path
    .split("/")
    .map((segment) => nodeIds[segment] ?? segment)
    .join("/");

function applyOne(props: InstanceProps, migration: ComponentMigration, warnings: MigrationWarning[]): InstanceProps {
  const propValues: Dict = { ...(props.propValues ?? {}) };
  const variant: Record<string, string> = { ...(props.variant ?? {}) };

  for (const [key, op] of Object.entries(migration.props ?? {})) {
    const present = key in propValues;
    if ("setDefault" in op) {
      if (!present || propValues[key] === undefined) propValues[key] = op.setDefault;
      continue;
    }
    if (!present) continue; // tak ada nilai user untuk dimigrasi.
    const value = propValues[key];
    if ("rename" in op) {
      propValues[op.rename] = value;
      delete propValues[key];
    } else if ("mapValues" in op) {
      if (typeof value === "string" && value in op.mapValues) propValues[key] = op.mapValues[value];
    } else if ("moveInto" in op) {
      setDeep(propValues, op.moveInto, value);
      delete propValues[key];
    } else if ("transform" in op) {
      propValues[key] = applyTransform(op.transform, value);
    } else if ("drop" in op) {
      warnings.push({ propKey: key, ...(op.note ? { note: op.note } : {}), previousValue: value });
      delete propValues[key];
    }
  }

  for (const [axis, op] of Object.entries(migration.variants ?? {})) {
    if (!(axis in variant)) continue;
    const current = variant[axis];
    const mapped = op.mapValues && current !== undefined && current in op.mapValues ? op.mapValues[current] : current;
    if (op.rename) {
      if (mapped !== undefined) variant[op.rename] = mapped;
      delete variant[axis];
    } else if (mapped !== undefined) {
      variant[axis] = mapped;
    }
  }

  // Remap override & slot keys.
  const overrides = props.overrides
    ? Object.fromEntries(
        Object.entries(props.overrides).map(([path, patch]) => [
          migration.nodeIds ? remapPath(path, migration.nodeIds) : path,
          patch,
        ]),
      )
    : undefined;
  const slots = props.slots
    ? Object.fromEntries(Object.entries(props.slots).map(([name, ids]) => [migration.slots?.[name] ?? name, ids]))
    : undefined;

  return {
    ...props,
    ...(Object.keys(propValues).length > 0 ? { propValues } : { propValues: undefined }),
    ...(Object.keys(variant).length > 0 ? { variant } : { variant: undefined }),
    ...(overrides ? { overrides } : {}),
    ...(slots ? { slots } : {}),
  } as InstanceProps;
}

/** CMP-054: migrasi props instance melalui rantai migrasi (urut). Pure. */
export function migrateInstance(props: InstanceProps, migrations: readonly ComponentMigration[]): MigrateResult {
  const warnings: MigrationWarning[] = [];
  let current = props;
  for (const migration of [...migrations].sort((a, b) => a.fromMajor - b.fromMajor))
    current = applyOne(current, migration, warnings);
  return { props: current, warnings };
}
