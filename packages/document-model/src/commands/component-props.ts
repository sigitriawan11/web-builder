import * as Y from "yjs";
import { z } from "zod";
import { walkJsonObjects } from "../query/walk-json";
import { CAMEL_KEY, type PropDef, PropDefSchema } from "../schema/component";
import { isPropRef, JsonValueSchema, NodeIdSchema } from "../schema/values";
import { cloneJson } from "../yjs/clone-json";
import { COMPONENT_YDOC_KEYS } from "../yjs/component-mapping";
import { yNodeToJson } from "../yjs/mapping";
import { defineCommand, fail } from "./command";
import { nodesMap, styleOf, type YNode } from "./y-access";

// CMP-020/CMP-021: command props & binding untuk draft ComponentDefinition (Mode Admin). Beroperasi pada Y.Doc
// component: `propsSchema` = Y.Array<PropDef>, binding `{$prop:key}` ditaruh di `node.visible`/`node.props.*`/
// `node.style.*`. Integritas `$prop ⊆ propsSchema` penuh dicek `validateComponentDefinition` (saat publish); command
// ini menjaga invariannya di titik mutasi (key unik, propKey dikenal, hapus prop ditolak bila masih dipakai).

const CamelKeySchema = z.string().min(1).max(64).regex(CAMEL_KEY, "key prop camelCase");

const propsArray = (doc: Y.Doc): Y.Array<unknown> => doc.getArray<unknown>(COMPONENT_YDOC_KEYS.propsSchema);

/** Index PropDef dengan `key` tertentu di propsSchema, atau -1. */
function propIndex(doc: Y.Doc, key: string): number {
  const array = propsArray(doc);
  for (let i = 0; i < array.length; i++) {
    const prop = array.get(i) as { key?: unknown } | undefined;
    if (prop?.key === key) return i;
  }
  return -1;
}

// Key propsSchema dari ref `$prop` — buang scope item list (`menuItems[].label` → `menuItems`). Mirror validate.
const propRefBase = (ref: string): string => ref.split(/[.[]/)[0] ?? ref;

/** ID node yang masih mem-bind `key` (di style/props/visible). Untuk menolak hapus prop yang dipakai (CMP-021). */
function nodesBindingProp(doc: Y.Doc, key: string): string[] {
  const nodes = nodesMap(doc);
  const bound: string[] = [];
  nodes.forEach((yNode, id) => {
    const json = yNodeToJson(yNode);
    let uses = false;
    for (const value of [json.style, json.props, json.visible]) {
      walkJsonObjects(value, [], (object) => {
        if (isPropRef(object) && propRefBase(object.$prop) === key) uses = true;
        return undefined;
      });
    }
    if (uses) bound.push(id);
  });
  return bound;
}

const PROP_LIMIT = 50;

// DM-046: tambah PropDef ke propsSchema (key unik, maks 50).
export const addComponentProp = defineCommand({
  name: "addComponentProp",
  description: { id: "Tambah prop component.", en: "Add a component prop." },
  aiExposed: false,
  input: z.object({ prop: PropDefSchema }),
  run(ctx, input) {
    const prop = input.prop as PropDef;
    const array = propsArray(ctx.doc);
    if (array.length >= PROP_LIMIT)
      return fail("LIMIT_EXCEEDED", { id: `Maks ${PROP_LIMIT} prop`, en: `At most ${PROP_LIMIT} props` }, ["prop"]);
    if (propIndex(ctx.doc, prop.key) >= 0)
      return fail(
        "INVALID_TARGET",
        { id: `Key prop "${prop.key}" sudah ada`, en: `Prop key "${prop.key}" already exists` },
        ["prop", "key"],
      );
    array.push([cloneJson(prop)]);
    return { ok: true, value: prop.key, affected: [] };
  },
});

// Ganti PropDef (identifikasi lewat `key`; ganti key = rename belum didukung di M3 — binding ikut berubah).
export const updateComponentProp = defineCommand({
  name: "updateComponentProp",
  description: { id: "Ubah prop component.", en: "Update a component prop." },
  aiExposed: false,
  input: z.object({ key: CamelKeySchema, prop: PropDefSchema }),
  run(ctx, input) {
    const prop = input.prop as PropDef;
    if (prop.key !== input.key)
      return fail(
        "INVALID_INPUT",
        { id: "Ganti key prop (rename) belum didukung", en: "Renaming a prop key is not supported yet" },
        ["prop", "key"],
      );
    const index = propIndex(ctx.doc, input.key);
    if (index < 0)
      return fail("NOT_FOUND", { id: `Prop "${input.key}" tidak ada`, en: `Prop "${input.key}" not found` }, ["key"]);
    const array = propsArray(ctx.doc);
    array.delete(index, 1);
    array.insert(index, [cloneJson(prop)]);
    return { ok: true, value: prop.key, affected: [] };
  },
});

// Hapus PropDef. Ditolak bila masih ada node yang mem-bind-nya (editor harus unbind dulu) → dokumen tetap valid.
export const removeComponentProp = defineCommand({
  name: "removeComponentProp",
  description: { id: "Hapus prop component.", en: "Remove a component prop." },
  aiExposed: false,
  input: z.object({ key: CamelKeySchema }),
  run(ctx, input) {
    const index = propIndex(ctx.doc, input.key);
    if (index < 0)
      return fail("NOT_FOUND", { id: `Prop "${input.key}" tidak ada`, en: `Prop "${input.key}" not found` }, ["key"]);
    const bound = nodesBindingProp(ctx.doc, input.key);
    if (bound.length > 0)
      return fail(
        "INVALID_TARGET",
        {
          id: `Prop "${input.key}" masih dipakai ${bound.length} node`,
          en: `Prop "${input.key}" is still bound by ${bound.length} node(s)`,
        },
        ["key"],
        { boundCount: bound.length },
      );
    propsArray(ctx.doc).delete(index, 1);
    return { ok: true, value: input.key, affected: [] };
  },
});

// ── Binding node → prop (DM-047) ─────────────────────────────────────────────

// Lokasi binding di dalam node: `visible`, satu key di `props` (content/image/link/name/alt/href/…), atau satu key
// style (breakpoint→group→key, mis. fills). Editor memetakan afordansi "⊕ Bind" ke salah satu bentuk ini.
const BindPathSchema = z.discriminatedUnion("field", [
  z.strictObject({ field: z.literal("visible") }),
  z.strictObject({ field: z.literal("prop"), key: z.string().min(1).max(64) }),
  z.strictObject({
    field: z.literal("style"),
    breakpoint: z.enum(["base", "tablet", "mobile"]),
    group: z.string().min(1).max(64),
    key: z.string().min(1).max(64),
  }),
]);
type BindPath = z.infer<typeof BindPathSchema>;

/** Y.Map `props` node (dibuat bila belum ada). */
function propsMapOf(yNode: YNode): Y.Map<unknown> {
  const existing = yNode.get("props");
  if (existing instanceof Y.Map) return existing as Y.Map<unknown>;
  const props = new Y.Map<unknown>();
  yNode.set("props", props);
  return props;
}

/** Y.Map style[breakpoint][group] (dibuat bila belum ada). */
function styleGroupOf(yNode: YNode, breakpoint: string, group: string): Y.Map<unknown> {
  const yStyle = styleOf(yNode) as unknown as Y.Map<unknown>;
  const existingBp = yStyle.get(breakpoint);
  let yBp: Y.Map<unknown>;
  if (existingBp instanceof Y.Map) yBp = existingBp as Y.Map<unknown>;
  else {
    yBp = new Y.Map<unknown>();
    yStyle.set(breakpoint, yBp);
  }
  const existingGroup = yBp.get(group);
  if (existingGroup instanceof Y.Map) return existingGroup as Y.Map<unknown>;
  const yGroup = new Y.Map<unknown>();
  yBp.set(group, yGroup);
  return yGroup;
}

function writeAtPath(yNode: YNode, path: BindPath, value: unknown): void {
  if (path.field === "visible") yNode.set("visible", value);
  else if (path.field === "prop") propsMapOf(yNode).set(path.key, value);
  else styleGroupOf(yNode, path.breakpoint, path.group).set(path.key, value);
}

function deleteAtPath(yNode: YNode, path: BindPath): void {
  if (path.field === "visible")
    yNode.set("visible", true); // tanpa binding, node terlihat.
  else if (path.field === "prop") {
    const props = yNode.get("props");
    if (props instanceof Y.Map) props.delete(path.key);
  } else {
    const yStyle = styleOf(yNode);
    const yBp = yStyle.get(path.breakpoint);
    if (yBp instanceof Y.Map) {
      const yGroup = yBp.get(path.group);
      if (yGroup instanceof Y.Map) yGroup.delete(path.key);
    }
  }
}

// DM-047: ganti nilai properti node dengan ref `{$prop:key}` (opsional `eq` untuk enum→boolean di `visible`).
export const bindProp = defineCommand({
  name: "bindProp",
  description: { id: "Bind properti node ke prop.", en: "Bind a node property to a prop." },
  aiExposed: false,
  input: z.strictObject({
    nodeId: NodeIdSchema,
    path: BindPathSchema,
    propKey: CamelKeySchema,
    eq: z.string().optional(),
  }),
  run(ctx, input) {
    const node = nodesMap(ctx.doc).get(input.nodeId);
    if (!node)
      return fail("NOT_FOUND", { id: `Node "${input.nodeId}" tidak ada`, en: `Node "${input.nodeId}" not found` }, [
        "nodeId",
      ]);
    if (propIndex(ctx.doc, input.propKey) < 0)
      return fail(
        "NOT_FOUND",
        { id: `Prop "${input.propKey}" belum didefinisikan`, en: `Prop "${input.propKey}" is not defined` },
        ["propKey"],
      );
    const ref = { $prop: input.propKey, ...(input.eq !== undefined ? { eq: input.eq } : {}) };
    writeAtPath(node, input.path, cloneJson(ref));
    return { ok: true, value: undefined, affected: [input.nodeId] };
  },
});

// Lepas binding: pasang nilai literal `value` (bila ada) atau hapus/kembalikan default (visible→true, prop/style→hapus).
export const unbindProp = defineCommand({
  name: "unbindProp",
  description: { id: "Lepas binding prop dari node.", en: "Unbind a prop from a node." },
  aiExposed: false,
  input: z.strictObject({ nodeId: NodeIdSchema, path: BindPathSchema, value: JsonValueSchema.optional() }),
  run(ctx, input) {
    const node = nodesMap(ctx.doc).get(input.nodeId);
    if (!node)
      return fail("NOT_FOUND", { id: `Node "${input.nodeId}" tidak ada`, en: `Node "${input.nodeId}" not found` }, [
        "nodeId",
      ]);
    if (input.value !== undefined) writeAtPath(node, input.path, cloneJson(input.value));
    else deleteAtPath(node, input.path);
    return { ok: true, value: undefined, affected: [input.nodeId] };
  },
});
