import * as Y from "yjs";
import { z } from "zod";
import { createId } from "../ids";
import { detachToSubtree } from "../resolve/detach";
import {
  ComponentIdSchema,
  type InstanceProps,
  InstancePropsSchema,
  type Node,
  NodeIdSchema,
  NodePatchSchema,
  NodePathSchema,
  NodeSchema,
  PropValueSchema,
  StylePatchSchema,
  StyleSchema,
} from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { nodeToYMap, YDOC_KEYS, yNodeToJson } from "../yjs/mapping";
import { type CommandContext, type CommandFailure, defineCommand, fail } from "./command";
import { exceeds, locate, pageNodeCount } from "./limits";
import { childrenOf, nodesMap, nodeType, type YNode } from "./y-access";

const MAX_ID_ATTEMPTS = 8;
const isFailure = (value: unknown): value is CommandFailure =>
  typeof value === "object" && value !== null && "ok" in value && value.ok === false;
const notFound = (id: string): CommandFailure =>
  fail("NOT_FOUND", { id: `Node "${id}" tidak ditemukan`, en: `Node "${id}" not found` }, ["id"]);

// Node instance (atau gagal). Dipakai semua command prop/variant/override/slot.
function instanceNode(ctx: CommandContext, id: string): YNode | CommandFailure {
  const node = nodesMap(ctx.doc).get(id);
  if (!node) return notFound(id);
  if (nodeType(node) !== "instance")
    return fail("INVALID_TARGET", { id: `Node "${id}" bukan instance`, en: `Node "${id}" is not an instance` }, ["id"]);
  return node;
}

// Baca props instance (plain JSON), terapkan `mutate`, validasi `InstancePropsSchema`, tulis balik key dinamis.
function updateProps(node: YNode, mutate: (props: InstanceProps) => InstanceProps): CommandFailure | undefined {
  const propsMap = node.get("props");
  if (!(propsMap instanceof Y.Map))
    return fail("INVALID_RESULT", { id: "props instance bukan Y.Map", en: "instance props is not a Y.Map" }, ["props"]);
  const current = propsMap.toJSON() as InstanceProps;
  const next = mutate(cloneJson(current));
  const parsed = InstancePropsSchema.safeParse(next);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(
      "INVALID_RESULT",
      { id: `props instance tidak valid: ${issue?.message}`, en: `invalid instance props: ${issue?.message}` },
      ["props", ...(issue?.path.map(String) ?? [])],
    );
  }
  for (const key of ["variant", "propValues", "overrides", "slots"] as const) {
    const value = parsed.data[key];
    if (value === undefined || (typeof value === "object" && Object.keys(value).length === 0)) propsMap.delete(key);
    else propsMap.set(key, cloneJson(value));
  }
  return undefined;
}

// DM-074: sisip instance component + catat dependency langsung (OPEN-DM-11: transitif dicatat caller ber-registry).
export const createInstance = defineCommand({
  name: "createInstance",
  description: { id: "Sisipkan instance component.", en: "Insert a component instance." },
  aiExposed: true,
  input: z.strictObject({
    parentId: NodeIdSchema,
    index: z.number().int().nonnegative().optional(),
    componentId: ComponentIdSchema,
    version: z.number().int().nonnegative(),
    source: z.enum(["library", "site", "marketplace"]).default("library"),
    variant: z.record(z.string(), z.string()).optional(),
    propValues: z.record(z.string(), PropValueSchema).optional(),
    slots: z.record(z.string(), z.array(NodeIdSchema)).optional(),
    name: z.string().min(1).max(80).optional(),
    style: z
      .strictObject({
        base: StyleSchema.optional(),
        tablet: StylePatchSchema.optional(),
        mobile: StylePatchSchema.optional(),
      })
      .optional(),
  }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    const parent = nodes.get(input.parentId);
    if (!parent)
      return fail(
        "NOT_FOUND",
        { id: `Parent "${input.parentId}" tidak ditemukan`, en: `Parent "${input.parentId}" not found` },
        ["parentId"],
      );
    const siblings = childrenOf(parent);
    if (!siblings)
      return fail(
        "INVALID_TARGET",
        { id: `Parent "${input.parentId}" bukan container`, en: `Parent "${input.parentId}" is not a container` },
        ["parentId"],
      );

    const idGen = ctx.idGen ?? createId;
    let id = idGen("n");
    for (let attempt = 1; nodes.has(id) && attempt < MAX_ID_ATTEMPTS; attempt++) id = idGen("n");
    if (nodes.has(id))
      return fail("INVALID_RESULT", { id: "Gagal membuat ID unik", en: "Failed to create a unique ID" });

    const parsed = NodeSchema.safeParse({
      id,
      type: "instance",
      name: input.name ?? "Instance",
      parentId: input.parentId,
      visible: true,
      locked: false,
      style: {
        base: input.style?.base ?? {},
        ...(input.style?.tablet ? { tablet: input.style.tablet } : {}),
        ...(input.style?.mobile ? { mobile: input.style.mobile } : {}),
      },
      props: {
        componentId: input.componentId,
        version: input.version,
        ...(input.variant ? { variant: input.variant } : {}),
        ...(input.propValues ? { propValues: input.propValues } : {}),
        ...(input.slots ? { slots: input.slots } : {}),
      },
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(
        "INVALID_RESULT",
        { id: `Instance tidak valid: ${issue?.message}`, en: `Invalid instance: ${issue?.message}` },
        issue?.path.map(String),
      );
    }

    const { pageId, depth } = locate(nodes, input.parentId);
    const limitError =
      exceeds("childrenPerContainer", siblings.length + 1, ["parentId"]) ??
      exceeds("nodesPerSite", nodes.size + 1) ??
      exceeds("treeDepth", depth + 1, ["parentId"]) ??
      (pageId ? exceeds("nodesPerPage", pageNodeCount(nodes, pageId) + 1, ["parentId"]) : null);
    if (limitError) return limitError;

    const index = Math.min(input.index ?? siblings.length, siblings.length);
    nodes.set(id, nodeToYMap(parsed.data));
    siblings.insert(index, [id]);
    // DM-069: catat dependency langsung (versi ter-pin). Transitif = caller ber-registry (OPEN-DM-11).
    ctx.doc
      .getMap<unknown>(YDOC_KEYS.componentDeps)
      .set(input.componentId, { version: input.version, source: input.source });
    return { ok: true, value: id, affected: [id, input.parentId] };
  },
});

export const setProp = defineCommand({
  name: "setProp",
  description: { id: "Set nilai prop instance.", en: "Set an instance prop value." },
  aiExposed: true,
  input: z.strictObject({
    id: NodeIdSchema,
    key: z.string().min(1).max(64),
    value: z.union([PropValueSchema, z.undefined()]),
  }),
  run(ctx, input) {
    const node = instanceNode(ctx, input.id);
    if (isFailure(node)) return node;
    const error = updateProps(node, (props) => {
      const propValues = { ...props.propValues };
      if (input.value === undefined) delete propValues[input.key];
      else propValues[input.key] = input.value;
      return { ...props, propValues };
    });
    return error ?? { ok: true, value: undefined, affected: [input.id] };
  },
});

export const setVariant = defineCommand({
  name: "setVariant",
  description: { id: "Set axis variant instance.", en: "Set an instance variant axis." },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, axis: z.string().min(1).max(64), option: z.string().min(1).max(64) }),
  run(ctx, input) {
    const node = instanceNode(ctx, input.id);
    if (isFailure(node)) return node;
    const error = updateProps(node, (props) => ({
      ...props,
      variant: { ...props.variant, [input.axis]: input.option },
    }));
    return error ?? { ok: true, value: undefined, affected: [input.id] };
  },
});

export const setInstanceOverride = defineCommand({
  name: "setInstanceOverride",
  description: { id: "Set override instance di satu node path.", en: "Set an instance override at a node path." },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, path: NodePathSchema, patch: NodePatchSchema }),
  run(ctx, input) {
    const node = instanceNode(ctx, input.id);
    if (isFailure(node)) return node;
    const error = updateProps(node, (props) => {
      const overrides = { ...props.overrides };
      overrides[input.path] = { ...overrides[input.path], ...input.patch };
      return { ...props, overrides };
    });
    return error ?? { ok: true, value: undefined, affected: [input.id] };
  },
});

export const resetOverride = defineCommand({
  name: "resetOverride",
  description: {
    id: "Hapus override instance (seluruh path atau satu field).",
    en: "Remove an instance override (whole path or one field).",
  },
  aiExposed: true,
  input: z.strictObject({
    id: NodeIdSchema,
    path: NodePathSchema,
    field: z.enum(["style", "states", "props", "visible"]).optional(),
  }),
  run(ctx, input) {
    const node = instanceNode(ctx, input.id);
    if (isFailure(node)) return node;
    const error = updateProps(node, (props) => {
      const overrides = { ...props.overrides };
      if (!(input.path in overrides)) return props;
      if (input.field) {
        const patch = { ...overrides[input.path] };
        delete patch[input.field];
        if (Object.keys(patch).length === 0) delete overrides[input.path];
        else overrides[input.path] = patch;
      } else {
        delete overrides[input.path];
      }
      return { ...props, overrides };
    });
    return error ?? { ok: true, value: undefined, affected: [input.id] };
  },
});

export const setSlotContent = defineCommand({
  name: "setSlotContent",
  description: {
    id: "Set isi slot instance (daftar node yang ada).",
    en: "Set an instance slot's content (existing node ids).",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, slotName: z.string().min(1).max(64), nodeIds: z.array(NodeIdSchema) }),
  run(ctx, input) {
    const node = instanceNode(ctx, input.id);
    if (isFailure(node)) return node;
    const nodes = nodesMap(ctx.doc);
    for (const nodeId of input.nodeIds) if (!nodes.has(nodeId)) return notFound(nodeId);
    const error = updateProps(node, (props) => {
      const slots = { ...props.slots };
      if (input.nodeIds.length === 0) delete slots[input.slotName];
      else slots[input.slotName] = input.nodeIds;
      return { ...props, slots };
    });
    return error ?? { ok: true, value: undefined, affected: [input.id] };
  },
});

// DM-050: detach instance → subtree node biasa (ID baru, $prop→literal, variant+override diterapkan). Butuh
// `ctx.getComponent` (registry). Satu transaksi, satu undo. Instance bersarang tetap instance (satu level).
export const detachInstance = defineCommand({
  name: "detachInstance",
  description: { id: "Detach instance menjadi node biasa.", en: "Detach an instance into plain nodes." },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema }),
  run(ctx, input) {
    if (!ctx.getComponent)
      return fail("INVALID_TARGET", { id: "registry component tidak tersedia", en: "component registry unavailable" }, [
        "id",
      ]);
    const nodes = nodesMap(ctx.doc);
    const yInst = nodes.get(input.id);
    if (!yInst) return notFound(input.id);
    if (nodeType(yInst) !== "instance")
      return fail(
        "INVALID_TARGET",
        { id: `Node "${input.id}" bukan instance`, en: `Node "${input.id}" is not an instance` },
        ["id"],
      );
    const inst = yNodeToJson(yInst) as Node & { type: "instance" };
    const parent = inst.parentId ? nodes.get(inst.parentId) : undefined;
    const siblings = parent ? childrenOf(parent) : undefined;
    if (!parent || !siblings)
      return fail(
        "INVALID_TARGET",
        { id: "instance tanpa parent container", en: "instance without a container parent" },
        ["id"],
      );

    const def = ctx.getComponent(inst.props.componentId, inst.props.version);
    if (!def)
      return fail(
        "NOT_FOUND",
        {
          id: `Component "${inst.props.componentId}@${inst.props.version}" tidak ada di registry`,
          en: `Component "${inst.props.componentId}@${inst.props.version}" not in registry`,
        },
        ["id"],
      );

    const detached = detachToSubtree(inst, def, ctx.idGen);
    // Validasi tiap node hasil detach (bentuk node site).
    for (const [id, node] of Object.entries(detached.nodes)) {
      const parsed = NodeSchema.safeParse(node);
      if (!parsed.success)
        return fail(
          "INVALID_RESULT",
          {
            id: `Node detach "${id}" tidak valid: ${parsed.error.issues[0]?.message}`,
            en: `Detached node "${id}" invalid: ${parsed.error.issues[0]?.message}`,
          },
          ["id"],
        );
    }
    const limit = exceeds("nodesPerSite", nodes.size - 1 + Object.keys(detached.nodes).length);
    if (limit) return limit;

    const index = siblings.toArray().indexOf(input.id);
    // Tulis: hapus instance, sisipkan root detach di posisinya, tambah node baru, pindahkan konten slot.
    siblings.delete(index, 1);
    nodes.delete(input.id);
    for (const [id, node] of Object.entries(detached.nodes)) nodes.set(id, nodeToYMap(node));
    siblings.insert(index < 0 ? siblings.length : index, [detached.rootId]);
    for (const move of detached.moved) nodes.get(move.nodeId)?.set("parentId", move.parentId);
    const deps = ctx.doc.getMap<unknown>(YDOC_KEYS.componentDeps);
    for (const [componentId, version] of Object.entries(detached.deps))
      deps.set(componentId, { version, source: "library" });

    const affected = [inst.parentId, detached.rootId, ...Object.keys(detached.nodes)].filter(
      (id): id is string => !!id,
    );
    return { ok: true, value: detached.rootId, affected };
  },
});
