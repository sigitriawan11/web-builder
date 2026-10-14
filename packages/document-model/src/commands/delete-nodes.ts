import { z } from "zod";
import { NodeIdSchema } from "../schema";
import { defineCommand, fail } from "./command";
import { childrenOf, collectSubtree, nodesMap, nodeType, parentIdOf } from "./y-access";

// DM-062: hapus node beserta seluruh turunannya + keluarkan dari children parent, dalam satu transaksi.
export const deleteNodes = defineCommand({
  name: "deleteNodes",
  description: {
    id: "Hapus node beserta seluruh turunannya (page dihapus lewat deletePage).",
    en: "Delete nodes together with all their descendants (pages are deleted via deletePage).",
  },
  aiExposed: true,
  input: z.strictObject({ ids: z.array(NodeIdSchema).min(1) }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    for (const [i, id] of input.ids.entries()) {
      const yNode = nodes.get(id);
      if (!yNode)
        return fail("NOT_FOUND", { id: `Node "${id}" tidak ditemukan`, en: `Node "${id}" not found` }, ["ids", i]);
      if (nodeType(yNode) === "page")
        return fail("INVALID_TARGET", { id: "Page dihapus lewat deletePage", en: "Pages are deleted via deletePage" }, [
          "ids",
          i,
        ]);
    }

    const removed = new Set<string>();
    for (const id of input.ids) collectSubtree(nodes, id, removed);

    // Cukup lepaskan akar subtree dari parent yang tidak ikut terhapus.
    for (const id of removed) {
      const yNode = nodes.get(id);
      const parentId = yNode ? parentIdOf(yNode) : null;
      if (!parentId || removed.has(parentId)) continue;
      const parent = nodes.get(parentId);
      const siblings = parent ? childrenOf(parent) : undefined;
      const index = siblings ? siblings.toArray().indexOf(id) : -1;
      if (siblings && index >= 0) siblings.delete(index, 1);
    }
    for (const id of removed) nodes.delete(id);

    const removedIds = [...removed];
    return { ok: true, value: { removedIds }, affected: removedIds };
  },
});
