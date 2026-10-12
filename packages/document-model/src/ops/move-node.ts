import { z } from "zod";
import { NodeIdSchema } from "../schema";
import { defineOp, fail } from "./op";
import { childrenOf, isSelfOrDescendant, nodesMap, nodeType, parentIdOf } from "./y-access";

// Flat map membuat move cukup mengubah parentId + dua array children (DM-059).
export const moveNode = defineOp({
  name: "moveNode",
  input: z.strictObject({
    id: NodeIdSchema,
    newParentId: NodeIdSchema,
    // Index posisi akhir di parent tujuan; lebih dari jumlah anak = taruh di akhir.
    index: z.number().int().nonnegative(),
  }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    const node = nodes.get(input.id);
    if (!node) return fail("NOT_FOUND", `Node "${input.id}" tidak ditemukan`, ["id"]);
    if (nodeType(node) === "page") return fail("INVALID_TARGET", "Page tidak bisa dipindah dengan moveNode", ["id"]);

    const newParent = nodes.get(input.newParentId);
    if (!newParent) return fail("NOT_FOUND", `Parent "${input.newParentId}" tidak ditemukan`, ["newParentId"]);
    const targetChildren = childrenOf(newParent);
    if (!targetChildren) return fail("INVALID_TARGET", `"${input.newParentId}" bukan container`, ["newParentId"]);
    if (isSelfOrDescendant(nodes, input.newParentId, input.id)) {
      return fail("CYCLE", `Node "${input.id}" tidak bisa dipindah ke dalam dirinya sendiri atau turunannya`, [
        "newParentId",
      ]);
    }

    const oldParentId = parentIdOf(node);
    const oldParent = oldParentId ? nodes.get(oldParentId) : undefined;
    const oldChildren = oldParent ? childrenOf(oldParent) : undefined;
    const oldIndex = oldChildren ? oldChildren.toArray().indexOf(input.id) : -1;
    if (oldChildren && oldIndex >= 0) oldChildren.delete(oldIndex, 1);

    targetChildren.insert(Math.min(input.index, targetChildren.length), [input.id]);
    if (oldParentId !== input.newParentId) node.set("parentId", input.newParentId);

    const affected = [input.id, input.newParentId];
    if (oldParentId && oldParentId !== input.newParentId) affected.push(oldParentId);
    return { ok: true, value: undefined, affected };
  },
});
