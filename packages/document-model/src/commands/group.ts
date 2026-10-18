import { z } from "zod";
import { NodeIdSchema } from "../schema";
import { defineCommand, fail } from "./command";
import { createNode } from "./create-node";
import { deleteNodes } from "./delete-nodes";
import { moveNode } from "./move-node";
import { updateStyle } from "./update-style";
import { childrenOf, nodesMap, parentIdOf, styleOf } from "./y-access";

type Pos = { type?: string; x?: number; y?: number } | undefined;
const absPos = (pos: Pos): { x: number; y: number } =>
  pos?.type === "absolute" ? { x: pos.x ?? 0, y: pos.y ?? 0 } : { x: 0, y: 0 };

// ED-144/DM-012: kelompokkan node terpilih (parent sama) jadi node `group` seukuran bounding box; anak jadi absolute
// relatif ke group (keepVisualPosition). Group tanpa fills/layout. Satu transaksi = satu undo.
export const groupNodes = defineCommand({
  name: "groupNodes",
  description: {
    id: "Kelompokkan node terpilih (parent sama) menjadi group.",
    en: "Group the selected nodes (same parent) into a group.",
  },
  // Butuh `rect` dari geometry editor; bukan tool AI.
  aiExposed: false,
  input: z.strictObject({
    ids: z.array(NodeIdSchema).min(1),
    rect: z.strictObject({
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
    }),
  }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    const firstId = input.ids[0];
    const first = firstId ? nodes.get(firstId) : undefined;
    if (!firstId || !first)
      return fail("NOT_FOUND", { id: `Node "${firstId}" tidak ditemukan`, en: `Node "${firstId}" not found` }, ["ids"]);
    const parentId = parentIdOf(first);
    if (!parentId)
      return fail(
        "INVALID_TARGET",
        { id: "Node tanpa parent (page) tidak bisa dikelompokkan", en: "A node without a parent cannot be grouped" },
        ["ids"],
      );
    for (const id of input.ids) {
      const node = nodes.get(id);
      if (!node)
        return fail("NOT_FOUND", { id: `Node "${id}" tidak ditemukan`, en: `Node "${id}" not found` }, ["ids"]);
      if (parentIdOf(node) !== parentId)
        return fail(
          "INVALID_INPUT",
          { id: "Semua node harus punya parent yang sama", en: "All nodes must share the same parent" },
          ["ids"],
        );
    }
    const parent = nodes.get(parentId);
    const parentChildren = parent ? childrenOf(parent) : undefined;
    if (!parentChildren)
      return fail(
        "INVALID_TARGET",
        { id: `Parent "${parentId}" bukan container`, en: `Parent "${parentId}" is not a container` },
        ["ids"],
      );

    const order = parentChildren.toArray();
    const ordered = input.ids.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const insertIndex = Math.min(...ordered.map((id) => order.indexOf(id)));

    // Group = kotak bounding box (absolute + size fixed); tanpa layout → anak absolute relatif ke group.
    const created = createNode.run(ctx, {
      parentId,
      index: insertIndex,
      type: "group",
      style: {
        base: {
          position: { type: "absolute", x: Math.round(input.rect.x), y: Math.round(input.rect.y) },
          size: {
            width: { mode: "fixed", value: Math.round(input.rect.width), unit: "px" },
            height: { mode: "fixed", value: Math.round(input.rect.height), unit: "px" },
          },
        },
      },
    });
    if (!created.ok) return created;
    const groupId = created.value;
    let index = 0;
    for (const id of ordered) {
      const moved = moveNode.run(ctx, { id, newParentId: groupId, index: index++, keepVisualPosition: true });
      if (!moved.ok) return moved;
    }
    return { ok: true, value: groupId, affected: [groupId, parentId, ...input.ids] };
  },
});

// ED-145/DM-012: bongkar group/frame — anak dipindah ke parent pada indeks node, posisi visual dipertahankan, lalu
// node dihapus. (Konfirmasi "style frame hilang" = urusan UI.) Satu transaksi = satu undo.
export const ungroup = defineCommand({
  name: "ungroup",
  description: {
    id: "Bongkar group/frame; anak naik ke parent, posisi dipertahankan.",
    en: "Ungroup; children move up to the parent, positions preserved.",
  },
  aiExposed: false,
  input: z.strictObject({ id: NodeIdSchema }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    const node = nodes.get(input.id);
    if (!node)
      return fail("NOT_FOUND", { id: `Node "${input.id}" tidak ditemukan`, en: `Node "${input.id}" not found` }, [
        "id",
      ]);
    const groupChildren = childrenOf(node);
    if (!groupChildren)
      return fail("INVALID_TARGET", { id: `"${input.id}" bukan container`, en: `"${input.id}" is not a container` }, [
        "id",
      ]);
    const parentId = parentIdOf(node);
    if (!parentId)
      return fail("INVALID_TARGET", { id: "Page tidak bisa dibongkar", en: "A page cannot be ungrouped" }, ["id"]);
    const parent = nodes.get(parentId);
    const parentChildren = parent ? childrenOf(parent) : undefined;
    if (!parentChildren)
      return fail("INVALID_TARGET", { id: `Parent "${parentId}" bukan container`, en: "Parent is not a container" }, [
        "id",
      ]);

    // Posisi group (relatif parent) → anak kembali di posisi absolut = group + anak (jaga visual meski parent flex
    // seperti page; moveNode keepVisualPosition hanya untuk target freeform).
    const group = absPos(styleOf(node).get("base")?.get("position") as Pos);
    const children = groupChildren.toArray();
    const childPositions = new Map(
      children.map((childId) => {
        const child = nodes.get(childId);
        return [childId, child ? absPos(styleOf(child).get("base")?.get("position") as Pos) : { x: 0, y: 0 }];
      }),
    );
    const groupIndex = parentChildren.toArray().indexOf(input.id);
    let offset = 0;
    for (const childId of children) {
      const moved = moveNode.run(ctx, { id: childId, newParentId: parentId, index: groupIndex + offset++ });
      if (!moved.ok) return moved;
      const local = childPositions.get(childId) ?? { x: 0, y: 0 };
      const restored = updateStyle.run(ctx, {
        ids: [childId],
        breakpoint: "base",
        patch: { position: { type: "absolute", x: group.x + local.x, y: group.y + local.y } },
      });
      if (!restored.ok) return restored;
    }
    const deleted = deleteNodes.run(ctx, { ids: [input.id] });
    if (!deleted.ok) return deleted;
    return { ok: true, value: undefined, affected: [parentId, ...children] };
  },
});
