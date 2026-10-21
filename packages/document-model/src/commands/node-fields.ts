import { z } from "zod";
import { jsonEqual } from "../query/normalize-overrides";
import { HtmlIdSchema, NodeIdSchema, NodeSchema } from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { yNodeToJson } from "../yjs/mapping";
import { type CommandContext, type CommandResult, defineCommand, fail } from "./command";
import { locate } from "./limits";
import { moveNode } from "./move-node";
import { childrenOf, nodesMap, parentIdOf, type YNode } from "./y-access";

// DM-074: command field sederhana node. Semua node divalidasi dulu (NodeSchema per tipe), baru ditulis.

type Fields = Record<string, unknown>;

function updateFields(ctx: CommandContext, ids: readonly string[], fields: Fields): CommandResult<undefined> {
  const nodes = nodesMap(ctx.doc);
  const planned: YNode[] = [];
  for (const [i, id] of ids.entries()) {
    const yNode = nodes.get(id);
    if (!yNode)
      return fail("NOT_FOUND", { id: `Node "${id}" tidak ditemukan`, en: `Node "${id}" not found` }, ["ids", i]);
    const parsed = (ctx.nodeSchema ?? NodeSchema).safeParse({ ...yNodeToJson(yNode), ...fields });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(
        "INVALID_RESULT",
        { id: `Node "${id}" tidak valid: ${issue?.message}`, en: `Node "${id}" would be invalid: ${issue?.message}` },
        issue?.path.filter((key): key is string | number => typeof key !== "symbol"),
      );
    }
    planned.push(yNode);
  }
  for (const yNode of planned) {
    for (const [key, value] of Object.entries(fields)) {
      if (!jsonEqual(yNode.get(key), value)) yNode.set(key, cloneJson(value));
    }
  }
  return { ok: true, value: undefined, affected: [...ids] };
}

const IdsSchema = z.array(NodeIdSchema).min(1);

export const renameNode = defineCommand({
  name: "renameNode",
  description: { id: "Ganti nama layer node.", en: "Rename a node layer." },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, name: z.string().trim().min(1).max(80) }),
  run: (ctx, input) => updateFields(ctx, [input.id], { name: input.name }),
});

export const setVisible = defineCommand({
  name: "setVisible",
  description: {
    id: "Tampilkan/sembunyikan node di semua breakpoint (tersembunyi tidak dipublish).",
    en: "Show/hide nodes at every breakpoint (hidden nodes are not published).",
  },
  aiExposed: true,
  input: z.strictObject({ ids: IdsSchema, visible: z.boolean() }),
  run: (ctx, input) => updateFields(ctx, input.ids, { visible: input.visible }),
});

export const setLocked = defineCommand({
  name: "setLocked",
  description: { id: "Kunci/buka kunci node di canvas.", en: "Lock/unlock nodes on the canvas." },
  aiExposed: true,
  input: z.strictObject({ ids: IdsSchema, locked: z.boolean() }),
  run: (ctx, input) => updateFields(ctx, input.ids, { locked: input.locked }),
});

export const setTag = defineCommand({
  name: "setTag",
  description: {
    id: "Ubah tag HTML semantik node (daftar yang diizinkan per tipe, DM-009).",
    en: "Change a node's semantic HTML tag (allowed list per type, DM-009).",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, tag: z.string().min(1).max(20) }),
  run: (ctx, input) => updateFields(ctx, [input.id], { tag: input.tag }),
});

export const setHtmlId = defineCommand({
  name: "setHtmlId",
  description: {
    id: "Pasang/hapus Anchor ID (htmlId) node — slug unik per page untuk tautan #anchor (DM-008/ED-220).",
    en: "Set/remove a node's Anchor ID (htmlId) — a slug unique per page for #anchor links (DM-008/ED-220).",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, htmlId: HtmlIdSchema.nullable() }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    const yNode = nodes.get(input.id);
    if (!yNode)
      return fail("NOT_FOUND", { id: `Node "${input.id}" tidak ditemukan`, en: `Node "${input.id}" not found` }, [
        "id",
      ]);
    if (input.htmlId === null) {
      if (yNode.get("htmlId") !== undefined) yNode.delete("htmlId");
      return { ok: true, value: undefined, affected: [input.id] };
    }
    // htmlId unik per page (DM-008): cek node lain di page yang sama.
    const pageId = locate(nodes, input.id).pageId;
    for (const [otherId, other] of nodes) {
      if (otherId === input.id || other.get("htmlId") !== input.htmlId) continue;
      if (locate(nodes, otherId).pageId === pageId) {
        return fail(
          "INVALID_RESULT",
          {
            id: `htmlId "${input.htmlId}" sudah dipakai di page yang sama`,
            en: `htmlId "${input.htmlId}" is already used on the same page`,
          },
          ["htmlId"],
        );
      }
    }
    return updateFields(ctx, [input.id], { htmlId: input.htmlId });
  },
});

export const reorderNode = defineCommand({
  name: "reorderNode",
  description: {
    id: "Ubah urutan node di dalam parent yang sama (index = posisi akhir).",
    en: "Reorder a node within the same parent (index = final position).",
  },
  aiExposed: true,
  input: z.strictObject({ id: NodeIdSchema, index: z.number().int().nonnegative() }),
  run(ctx, input) {
    const yNode = nodesMap(ctx.doc).get(input.id);
    const parentId = yNode ? parentIdOf(yNode) : null;
    if (!yNode || !parentId) {
      return fail(
        "NOT_FOUND",
        { id: `Node "${input.id}" tidak ditemukan atau page`, en: `Node "${input.id}" not found or is a page` },
        ["id"],
      );
    }
    const siblings = childrenOf(nodesMap(ctx.doc).get(parentId) as YNode);
    const index = Math.min(input.index, (siblings?.length ?? 1) - 1);
    return moveNode.run(ctx, { id: input.id, newParentId: parentId, index });
  },
});
