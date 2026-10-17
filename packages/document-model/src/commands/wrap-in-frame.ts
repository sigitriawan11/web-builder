import { z } from "zod";
import { NodeIdSchema } from "../schema";
import { defineCommand, fail } from "./command";
import { createNode } from "./create-node";
import { moveNode } from "./move-node";
import { childrenOf, nodesMap, parentIdOf } from "./y-access";

// ED-146: bungkus node terpilih (parent sama) dalam frame baru. `rect` (world, dari geometry editor) → frame
// freeform seukuran bounding box; tanpa `rect` → frame Hug (untuk parent auto-layout). Satu transaksi = satu undo.
export const wrapInFrame = defineCommand({
  name: "wrapInFrame",
  description: {
    id: "Bungkus node terpilih (parent sama) dalam frame baru.",
    en: "Wrap the selected nodes (same parent) in a new frame.",
  },
  // Butuh `rect` dari geometry editor (freeform); bukan tool AI.
  aiExposed: false,
  input: z.strictObject({
    ids: z.array(NodeIdSchema).min(1),
    rect: z
      .strictObject({
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().nonnegative(),
        height: z.number().nonnegative(),
      })
      .optional(),
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
        { id: "Node tanpa parent (page) tidak bisa dibungkus", en: "A node without a parent (page) cannot be wrapped" },
        ["ids"],
      );
    for (const id of input.ids) {
      const node = nodes.get(id);
      if (!node)
        return fail("NOT_FOUND", { id: `Node "${id}" tidak ditemukan`, en: `Node "${id}" not found` }, ["ids"]);
      if (parentIdOf(node) !== parentId)
        return fail(
          "INVALID_INPUT",
          {
            id: "Semua node harus punya parent yang sama untuk dibungkus",
            en: "All nodes must share the same parent to be wrapped",
          },
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
    // Pertahankan urutan dokumen; frame disisipkan di posisi node pertama (terdepan) dari seleksi.
    const ordered = input.ids.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const insertIndex = Math.min(...ordered.map((id) => order.indexOf(id)));

    const style = input.rect
      ? {
          base: {
            layout: { mode: "none" as const },
            position: { type: "absolute" as const, x: Math.round(input.rect.x), y: Math.round(input.rect.y) },
            size: {
              width: { mode: "fixed" as const, value: Math.round(input.rect.width), unit: "px" as const },
              height: { mode: "fixed" as const, value: Math.round(input.rect.height), unit: "px" as const },
            },
          },
        }
      : { base: { size: { width: { mode: "hug" as const }, height: { mode: "hug" as const } } } };

    const created = createNode.run(ctx, { parentId, index: insertIndex, type: "frame", style });
    if (!created.ok) return created;
    const frameId = created.value;
    let index = 0;
    for (const id of ordered) {
      const moved = moveNode.run(ctx, {
        id,
        newParentId: frameId,
        index: index++,
        keepVisualPosition: Boolean(input.rect),
      });
      if (!moved.ok) return moved;
    }
    return { ok: true, value: frameId, affected: [frameId, parentId, ...input.ids] };
  },
});
