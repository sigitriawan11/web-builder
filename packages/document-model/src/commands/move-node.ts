import { z } from "zod";
import { NodeIdSchema } from "../schema";
import { defineCommand, fail } from "./command";
import { exceeds, locate, pageNodeCount, subtreeHeight } from "./limits";
import { childrenOf, collectSubtree, isSelfOrDescendant, nodesMap, nodeType, parentIdOf } from "./y-access";

// Flat map membuat move cukup mengubah parentId + dua array children (DM-059).
export const moveNode = defineCommand({
  name: "moveNode",
  description: {
    id: "Pindahkan node ke parent lain atau ubah urutannya (index = posisi akhir di parent tujuan).",
    en: "Move a node to another parent or reorder it (index = final position in the target parent).",
  },
  aiExposed: true,
  input: z.strictObject({
    id: NodeIdSchema,
    newParentId: NodeIdSchema,
    // Index posisi akhir di parent tujuan; lebih dari jumlah anak = taruh di akhir.
    index: z.number().int().nonnegative(),
  }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    const node = nodes.get(input.id);
    if (!node)
      return fail("NOT_FOUND", { id: `Node "${input.id}" tidak ditemukan`, en: `Node "${input.id}" not found` }, [
        "id",
      ]);
    if (nodeType(node) === "page")
      return fail(
        "INVALID_TARGET",
        { id: "Page tidak bisa dipindah dengan moveNode", en: "Pages cannot be moved with moveNode" },
        ["id"],
      );

    const newParent = nodes.get(input.newParentId);
    if (!newParent)
      return fail(
        "NOT_FOUND",
        { id: `Parent "${input.newParentId}" tidak ditemukan`, en: `Parent "${input.newParentId}" not found` },
        ["newParentId"],
      );
    const targetChildren = childrenOf(newParent);
    if (!targetChildren)
      return fail(
        "INVALID_TARGET",
        { id: `"${input.newParentId}" bukan container`, en: `"${input.newParentId}" is not a container` },
        ["newParentId"],
      );
    if (isSelfOrDescendant(nodes, input.newParentId, input.id)) {
      return fail(
        "CYCLE",
        {
          id: `Node "${input.id}" tidak bisa dipindah ke dalam dirinya sendiri atau turunannya`,
          en: `Node "${input.id}" cannot be moved into itself or its descendants`,
        },
        ["newParentId"],
      );
    }

    // DM-076: pindah ke parent/page lain tidak boleh melewati batas (dicek sebelum menulis).
    const currentParentId = parentIdOf(node);
    if (currentParentId !== input.newParentId) {
      const target = locate(nodes, input.newParentId);
      const source = locate(nodes, input.id);
      const limitError =
        exceeds("childrenPerContainer", targetChildren.length + 1, ["newParentId"]) ??
        exceeds("treeDepth", target.depth + 1 + subtreeHeight(nodes, input.id), ["newParentId"]) ??
        (target.pageId && target.pageId !== source.pageId
          ? exceeds("nodesPerPage", pageNodeCount(nodes, target.pageId) + collectSubtree(nodes, input.id).size, [
              "newParentId",
            ])
          : null);
      if (limitError) return limitError;
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
