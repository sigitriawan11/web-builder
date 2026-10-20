import { z } from "zod";
import { walkJsonObjects } from "../query/walk-json";
import { type ComponentDefinition, ComponentDefinitionSchema, type PropDef } from "../schema/component";
import { isPropRef, PropRefSchema } from "../schema/values";
import type { Issue, IssueCode, IssueMessage } from "./issues";

// Zod path (PropertyKey[]) → path issue (string|number) — symbol tidak muncul di path dokumen.
const toPath = (path: readonly PropertyKey[]): (string | number)[] =>
  path.map((key) => (typeof key === "number" ? key : String(key)));

// DM-045–DM-049: validasi ComponentDefinition (Mode Admin / library seed). Mirror validateDocument:
// envelope Zod (ComponentDefinitionSchema) → cek integritas (rootId, envelope node, $prop ⊆ propsSchema,
// slotName unik, tanpa self-instance langsung, variant axis). Bentuk-dalam node (style/props) divalidasi
// permisif di M3 (boleh $prop/$token); validasi bentuk penuh lewat node schema varian `cv()` = pengerasan lanjutan.

const ChildId = z.string().regex(/^n_[0-9a-z]{6,24}$/);
const COMPONENT_NODE_TYPES = ["frame", "text", "image", "shape", "icon", "group", "instance", "slot"] as const;
const CONTAINER_TYPES = new Set(["frame", "group", "slot"]);

const envelope = (type: (typeof COMPONENT_NODE_TYPES)[number]) =>
  z.strictObject({
    id: ChildId,
    type: z.literal(type),
    parentId: z.union([ChildId, z.null()]),
    name: z.string().min(1).max(80),
    // `visible` boleh di-binding ke prop boolean (DM-047).
    visible: z.union([z.boolean(), PropRefSchema]),
    locked: z.boolean(),
    // Bentuk-dalam permisif (boleh $prop/$token); divalidasi penuh saat pengerasan cv().
    style: z.unknown().optional(),
    props: z.unknown().optional(),
    a11y: z.unknown().optional(),
    metadata: z.unknown().optional(),
    htmlId: z.unknown().optional(),
    tag: z.string().optional(),
    ...(CONTAINER_TYPES.has(type) ? { children: z.array(ChildId) } : {}),
  });

export const ComponentNodeSchema = z.discriminatedUnion(
  "type",
  COMPONENT_NODE_TYPES.map(envelope) as [ReturnType<typeof envelope>, ...ReturnType<typeof envelope>[]],
);

export interface ComponentValidationResult {
  ok: boolean;
  definition?: ComponentDefinition;
  issues: Issue[];
}

const msg = (id: string, en: string): IssueMessage => ({ id, en });
// Key propsSchema dari ref `$prop` — buang scope item (`menuItems[].label` → `menuItems`, `item.name` → `item`).
const propRefBase = (ref: string): string => ref.split(/[.[]/)[0] ?? ref;

/** Validasi ComponentDefinition (DM-045 AC). `item`/`index` di binding list dikecualikan dari cek `$prop ⊆ props`. */
export function validateComponentDefinition(input: unknown): ComponentValidationResult {
  const parsed = ComponentDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    const issues: Issue[] = parsed.error.issues.map((issue) => ({
      code: "COMPONENT_SCHEMA" as IssueCode,
      path: toPath(issue.path),
      message: msg(issue.message, issue.message),
    }));
    return { ok: false, issues };
  }
  const def = parsed.data;
  const issues: Issue[] = [];
  const report = (code: IssueCode, path: (string | number)[], message: IssueMessage, nodeId?: string) =>
    issues.push({ code, path, message, ...(nodeId ? { nodeId } : {}) });

  // Key prop unik + kumpulan key yang dikenal (termasuk alias scope list `item`).
  const propKeys = new Set<string>();
  for (const [index, prop] of (def.propsSchema as PropDef[]).entries()) {
    if (propKeys.has(prop.key)) {
      report(
        "PROP_KEY_DUPLICATE",
        ["propsSchema", index, "key"],
        msg(`Key prop "${prop.key}" duplikat`, `Duplicate prop key "${prop.key}"`),
      );
    }
    propKeys.add(prop.key);
  }
  // Alias binding list (DM-047): `item` scope di dalam repeater — tidak harus ada di propsSchema.
  const knownRefs = new Set<string>([...propKeys, "item", "index"]);

  // rootId ada & jadi root (parentId null).
  const rootNode = def.nodes[def.rootId];
  if (!rootNode) {
    report(
      "COMPONENT_ROOT",
      ["rootId"],
      msg(`rootId "${def.rootId}" tidak ada di nodes`, `rootId "${def.rootId}" not in nodes`),
    );
  }

  const slotNames = new Set<string>();
  for (const [nodeId, raw] of Object.entries(def.nodes)) {
    const env = ComponentNodeSchema.safeParse(raw);
    if (!env.success) {
      for (const issue of env.error.issues) {
        report("COMPONENT_NODE", ["nodes", nodeId, ...toPath(issue.path)], msg(issue.message, issue.message), nodeId);
      }
      continue;
    }
    const node = env.data;
    if (node.id !== nodeId) {
      report("COMPONENT_NODE", ["nodes", nodeId, "id"], msg("id node ≠ key", "node id ≠ key"), nodeId);
    }
    // Root = parentId null; node lain = parentId menunjuk node yang ada.
    if (nodeId === def.rootId) {
      if (node.parentId !== null)
        report(
          "COMPONENT_ROOT",
          ["nodes", nodeId, "parentId"],
          msg("root harus parentId null", "root must have parentId null"),
          nodeId,
        );
    } else if (node.parentId === null || !def.nodes[node.parentId]) {
      report(
        "COMPONENT_NODE",
        ["nodes", nodeId, "parentId"],
        msg("parentId tidak menunjuk node yang ada", "parentId does not point to an existing node"),
        nodeId,
      );
    }
    // Self-instance langsung (DM-045): instance tak boleh merujuk component-nya sendiri.
    if (node.type === "instance") {
      const cid = (node.props as { componentId?: unknown } | undefined)?.componentId;
      if (cid === def.id) {
        report(
          "SELF_INSTANCE",
          ["nodes", nodeId, "props", "componentId"],
          msg("Component tidak boleh meng-instance dirinya", "A component cannot instance itself"),
          nodeId,
        );
      }
    }
    // slotName unik (DM-019).
    if (node.type === "slot") {
      const name = (node.props as { slotName?: unknown } | undefined)?.slotName;
      if (typeof name === "string") {
        if (slotNames.has(name))
          report(
            "SLOT_NAME_DUPLICATE",
            ["nodes", nodeId, "props", "slotName"],
            msg(`slotName "${name}" duplikat`, `Duplicate slotName "${name}"`),
            nodeId,
          );
        slotNames.add(name);
      }
    }
    // Semua `$prop` di style/props/visible merujuk key yang dikenal (DM-047).
    for (const value of [node.style, node.props, node.visible]) {
      walkJsonObjects(value, [], (object) => {
        if (isPropRef(object)) {
          const base = propRefBase(object.$prop);
          if (!knownRefs.has(base)) {
            report(
              "PROP_REF_UNKNOWN",
              ["nodes", nodeId],
              msg(`$prop "${object.$prop}" tidak ada di propsSchema`, `$prop "${object.$prop}" is not in propsSchema`),
              nodeId,
            );
          }
        }
        return undefined;
      });
    }
  }

  // Variant `when` merujuk axis & option yang ada (DM-048).
  const axes = new Map((def.variantAxes ?? []).map((axis) => [axis.name, new Set(axis.options)]));
  for (const [index, rule] of (def.variants ?? []).entries()) {
    for (const [axisName, option] of Object.entries(rule.when)) {
      if (!axes.get(axisName)?.has(option)) {
        report(
          "VARIANT_AXIS_UNKNOWN",
          ["variants", index, "when", axisName],
          msg(
            `when "${axisName}: ${option}" tidak cocok variantAxes`,
            `when "${axisName}: ${option}" does not match variantAxes`,
          ),
        );
      }
    }
  }

  return { ok: issues.length === 0, ...(issues.length === 0 ? { definition: def } : {}), issues };
}
