import type * as Y from "yjs";
import { z } from "zod";
import { NodeIdSchema } from "../schema";
import { defineCommand, fail } from "./command";
import { exceeds, locate, pageNodeCount, subtreeHeight } from "./limits";
import {
  childrenOf,
  collectSubtree,
  isSelfOrDescendant,
  nodesMap,
  nodeType,
  parentIdOf,
  styleOf,
  type YNode,
} from "./y-access";

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
    // AC DM-074: bila parent tujuan `layout: none`, hitung x/y baru agar node tidak berpindah secara visual.
    keepVisualPosition: z.boolean().optional(),
    // Posisi kiri-atas (koordinat world) node & parent tujuan dari geometry editor; wajib bila posisi tidak bisa
    // diturunkan dari dokumen (ada ancestor ber-flow, posisinya hanya diketahui setelah layout).
    measured: z
      .strictObject({
        node: z.strictObject({ x: z.number().finite(), y: z.number().finite() }),
        newParent: z.strictObject({ x: z.number().finite(), y: z.number().finite() }),
      })
      .optional(),
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

    let position: { x: number; y: number } | null = null;
    // DM-012: group (tanpa layout) juga freeform — anaknya selalu absolute relatif ke group.
    const freeformTarget = baseLayoutMode(newParent) === "none" || nodeType(newParent) === "group";
    if (input.keepVisualPosition && freeformTarget) {
      position = input.measured
        ? {
            x: input.measured.node.x - input.measured.newParent.x,
            y: input.measured.node.y - input.measured.newParent.y,
          }
        : relativeOffset(nodes, input.id, input.newParentId);
      if (!position) {
        return fail(
          "INVALID_INPUT",
          {
            id: "Posisi visual tidak bisa dihitung dari dokumen (ada ancestor ber-flow); sertakan `measured`",
            en: "Visual position cannot be derived from the document (a flow ancestor exists); pass `measured`",
          },
          ["measured"],
        );
      }
    }

    const oldParentId = parentIdOf(node);
    const oldParent = oldParentId ? nodes.get(oldParentId) : undefined;
    const oldChildren = oldParent ? childrenOf(oldParent) : undefined;
    const oldIndex = oldChildren ? oldChildren.toArray().indexOf(input.id) : -1;
    if (oldChildren && oldIndex >= 0) oldChildren.delete(oldIndex, 1);

    targetChildren.insert(Math.min(input.index, targetChildren.length), [input.id]);
    if (oldParentId !== input.newParentId) node.set("parentId", input.newParentId);
    if (position) {
      const yBase = styleOf(node).get("base");
      const current = yBase?.get("position") as { type?: string; constraints?: unknown } | undefined;
      yBase?.set("position", {
        type: "absolute",
        x: position.x,
        y: position.y,
        ...(current?.type === "absolute" && current.constraints ? { constraints: current.constraints } : {}),
      });
    }

    const affected = [input.id, input.newParentId];
    if (oldParentId && oldParentId !== input.newParentId) affected.push(oldParentId);
    return { ok: true, value: undefined, affected };
  },
});

function baseLayoutMode(yNode: YNode): string | undefined {
  const layout = styleOf(yNode).get("base")?.get("layout") as { mode?: string } | undefined;
  return layout?.mode;
}

// Rantai node → akar (termasuk dirinya), berhenti di page.
function ancestry(nodes: Y.Map<YNode>, id: string): string[] {
  const chain: string[] = [];
  for (let current: string | null = id; current && chain.length <= nodes.size; ) {
    chain.push(current);
    const yNode = nodes.get(current);
    current = yNode ? parentIdOf(yNode) : null;
  }
  return chain;
}

// Jumlah x/y node-node di `chain` sebelum `stop`; `null` bila salah satunya bukan absolute (posisi bergantung layout).
function sumOffsets(nodes: Y.Map<YNode>, chain: readonly string[], stop: string): { x: number; y: number } | null {
  let x = 0;
  let y = 0;
  for (const id of chain) {
    if (id === stop) return { x, y };
    const yNode = nodes.get(id);
    const position = yNode
      ? (styleOf(yNode).get("base")?.get("position") as { type?: string; x?: number; y?: number } | undefined)
      : undefined;
    if (position?.type !== "absolute") return null;
    x += position.x ?? 0;
    y += position.y ?? 0;
  }
  return null;
}

/**
 * Posisi node relatif ke parent tujuan, dihitung terhadap ancestor bersama terdekat: node & parent tujuan beserta
 * ancestor-nya di bawah ancestor bersama harus `absolute` (posisi flow baru diketahui setelah layout → `null`).
 */
function relativeOffset(nodes: Y.Map<YNode>, id: string, newParentId: string): { x: number; y: number } | null {
  const nodeChain = ancestry(nodes, id);
  const parentChain = ancestry(nodes, newParentId);
  const common = nodeChain.slice(1).find((ancestor) => parentChain.includes(ancestor));
  if (!common) return null;
  const from = sumOffsets(nodes, nodeChain, common);
  const to = sumOffsets(nodes, parentChain, common);
  if (!from || !to) return null;
  return { x: from.x - to.x, y: from.y - to.y };
}
