import type * as Y from "yjs";
import { z } from "zod";
import { createId } from "../ids";
import { plainText } from "../query/rich-text";
import { walkJsonObjects } from "../query/walk-json";
import { type Node, NodeIdSchema, NodeSchema } from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { nodeToYMap, yNodeToJson } from "../yjs/mapping";
import { type CommandContext, type CommandFailure, defineCommand, fail } from "./command";
import { exceeds, locate, pageNodeCount } from "./limits";
import { childrenOf, collectSubtree, nodesMap, nodeType, parentIdOf, type YNode } from "./y-access";

// DM-070/DM-074: subtree = potongan tree datar (seperti `doc.nodes`) dengan ID sementara `tmp_*` (atau ID asli saat
// duplikasi) yang di-remap ke ID baru. Dipakai `insertSubtree` (AI membuat satu section) & `duplicateNodes`.

const SubtreeIdSchema = z
  .string()
  .regex(/^(tmp_[A-Za-z0-9_-]{1,40}|n_[0-9a-z]{6,24})$/, "ID subtree harus tmp_* atau n_*");

export const SubtreeSchema = z.strictObject({
  // Akar berurutan (disisipkan berdampingan di parent tujuan).
  rootIds: z.array(SubtreeIdSchema).min(1),
  // Node lengkap tanpa `id` wajib (diambil dari key); relasi parent/children memakai ID subtree.
  nodes: z.record(SubtreeIdSchema, z.record(z.string(), z.unknown())),
});

export type Subtree = z.infer<typeof SubtreeSchema>;

interface SubtreePlan {
  idMap: Record<string, string>;
  nodes: Node[];
  rootIds: string[];
  height: number;
}

type JsonRecord = Record<string, unknown>;

const subtreeError = (id: string, en: string, path: (string | number)[]): CommandFailure =>
  fail("INVALID_INPUT", { id, en }, ["subtree", ...path]);

// Rujukan internal di props (anchor link, page link dengan anchor) ikut di-remap bila menunjuk node di subtree.
function remapRefs(props: unknown, idMap: Record<string, string>): void {
  walkJsonObjects(props, [], (object) => {
    if (object.type === "anchor" && typeof object.nodeId === "string" && idMap[object.nodeId]) {
      object.nodeId = idMap[object.nodeId];
      return true;
    }
    if (object.type === "page" && typeof object.anchorNodeId === "string" && idMap[object.anchorNodeId]) {
      object.anchorNodeId = idMap[object.anchorNodeId];
      return true;
    }
    return false;
  });
}

/**
 * Validasi & remap subtree terhadap `parentId` tanpa menulis apa pun: struktur internal konsisten (semua node
 * terjangkau dari akar, tanpa siklus, tanpa page), ID baru unik, setiap node lolos `NodeSchema`.
 */
export function planSubtree(
  ctx: CommandContext,
  parentId: string,
  subtree: Subtree,
  reserved: Set<string> = new Set(),
): SubtreePlan | CommandFailure {
  const nodes = nodesMap(ctx.doc);
  const { rootIds } = subtree;
  const source = subtree.nodes;

  // Telusuri dari akar: setiap node tepat sekali, parentId konsisten dengan children.
  const order: string[] = [];
  const seen = new Set<string>();
  const parentOf = new Map<string, string>();
  const depthOf = new Map<string, number>();
  const stack: [string, number][] = [...rootIds].reverse().map((id) => [id, 0]);
  for (const id of rootIds) parentOf.set(id, parentId);
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) continue;
    const [id, depth] = entry;
    const node = source[id];
    if (!node)
      return subtreeError(`Node "${id}" tidak ada di subtree`, `Node "${id}" is missing from the subtree`, [
        "nodes",
        id,
      ]);
    if (seen.has(id)) {
      return subtreeError(
        `Node "${id}" muncul lebih dari sekali (siklus?)`,
        `Node "${id}" appears more than once (cycle?)`,
        ["nodes", id],
      );
    }
    if (node.type === "page")
      return subtreeError("Subtree tidak boleh berisi page", "A subtree cannot contain pages", ["nodes", id]);
    seen.add(id);
    order.push(id);
    depthOf.set(id, depth);
    const children = Array.isArray(node.children) ? (node.children as unknown[]) : [];
    for (const childId of [...children].reverse()) {
      if (typeof childId !== "string")
        return subtreeError("children harus ID", "children must be IDs", ["nodes", id, "children"]);
      parentOf.set(childId, id);
      stack.push([childId, depth + 1]);
    }
  }
  for (const id of Object.keys(source)) {
    if (!seen.has(id)) {
      return subtreeError(`Node "${id}" tidak terjangkau dari rootIds`, `Node "${id}" is not reachable from rootIds`, [
        "nodes",
        id,
      ]);
    }
  }

  const idGen = ctx.idGen ?? createId;
  const idMap: Record<string, string> = {};
  for (const id of order) {
    let next = idGen("n");
    for (let attempt = 0; (nodes.has(next) || reserved.has(next)) && attempt < 5; attempt++) next = idGen("n");
    if (nodes.has(next) || reserved.has(next)) {
      return fail("INVALID_RESULT", { id: "Gagal membuat ID unik", en: "Failed to create a unique ID" });
    }
    reserved.add(next);
    idMap[id] = next;
  }

  const planned: Node[] = [];
  for (const id of order) {
    const json = cloneJson(source[id] ?? {}) as JsonRecord;
    json.id = idMap[id];
    const originalParent = parentOf.get(id) ?? parentId;
    json.parentId = idMap[originalParent] ?? parentId;
    if (Array.isArray(json.children)) json.children = (json.children as string[]).map((child) => idMap[child] ?? child);
    remapRefs(json.props, idMap);
    const parsed = (ctx.nodeSchema ?? NodeSchema).safeParse(json);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return subtreeError(`Node "${id}" tidak valid: ${issue?.message}`, `Node "${id}" is invalid: ${issue?.message}`, [
        "nodes",
        id,
        ...(issue?.path.filter((key): key is string | number => typeof key !== "symbol") ?? []),
      ]);
    }
    planned.push(parsed.data as Node);
  }

  return {
    idMap,
    nodes: planned,
    rootIds: rootIds.map((id) => idMap[id] ?? id),
    height: Math.max(0, ...depthOf.values()),
  };
}

// htmlId unik per page (DM-008): subtree baru tidak boleh memakai anchor yang sudah ada di page tujuan.
function htmlIdsOfPage(nodes: Y.Map<YNode>, pageId: string | undefined): Set<string> {
  const ids = new Set<string>();
  if (!pageId) return ids;
  for (const id of collectSubtree(nodes, pageId)) {
    const htmlId = nodes.get(id)?.get("htmlId");
    if (typeof htmlId === "string") ids.add(htmlId);
  }
  return ids;
}

interface Placement {
  parentId: string;
  index: number;
  plan: SubtreePlan;
}

/** Cek batas DM-076 & htmlId untuk semua penempatan sekaligus (belum ada yang ditulis). */
function checkPlacements(ctx: CommandContext, placements: readonly Placement[]): CommandFailure | null {
  const nodes = nodesMap(ctx.doc);
  const total = placements.reduce((sum, placement) => sum + placement.plan.nodes.length, 0);
  const siteLimit = exceeds("nodesPerSite", nodes.size + total);
  if (siteLimit) return siteLimit;

  const perParent = new Map<string, number>();
  const perPage = new Map<string, number>();
  for (const { parentId, plan } of placements) {
    const parent = nodes.get(parentId);
    const children = parent ? childrenOf(parent) : undefined;
    if (!parent || !children) {
      return fail(
        "INVALID_TARGET",
        { id: `Parent "${parentId}" bukan container`, en: `Parent "${parentId}" is not a container` },
        ["parentId"],
      );
    }
    const added = (perParent.get(parentId) ?? children.length) + plan.rootIds.length;
    perParent.set(parentId, added);
    const childLimit = exceeds("childrenPerContainer", added, ["parentId"]);
    if (childLimit) return childLimit;

    const { pageId, depth } = locate(nodes, parentId);
    const depthLimit = exceeds("treeDepth", depth + 1 + plan.height, ["parentId"]);
    if (depthLimit) return depthLimit;
    if (pageId) {
      const count = (perPage.get(pageId) ?? pageNodeCount(nodes, pageId)) + plan.nodes.length;
      perPage.set(pageId, count);
      const pageLimit = exceeds("nodesPerPage", count, ["parentId"]);
      if (pageLimit) return pageLimit;
    }

    const taken = htmlIdsOfPage(nodes, pageId);
    for (const node of plan.nodes) {
      if (node.type === "text") {
        const textLimit = exceeds("textCharsPerNode", plainText(node.props.content).length, ["subtree"]);
        if (textLimit) return textLimit;
      }
      if (node.htmlId === undefined) continue;
      if (taken.has(node.htmlId)) {
        return fail(
          "INVALID_RESULT",
          {
            id: `htmlId "${node.htmlId}" sudah dipakai di page tujuan`,
            en: `htmlId "${node.htmlId}" is already used on the target page`,
          },
          ["subtree"],
        );
      }
      taken.add(node.htmlId);
    }
  }
  return null;
}

function writePlacements(ctx: CommandContext, placements: readonly Placement[]): string[] {
  const nodes = nodesMap(ctx.doc);
  const affected: string[] = [];
  for (const { parentId, index, plan } of placements) {
    for (const node of plan.nodes) nodes.set(node.id, nodeToYMap(node));
    const siblings = nodes.get(parentId);
    const children = siblings ? childrenOf(siblings) : undefined;
    children?.insert(Math.min(index, children.length), plan.rootIds);
    affected.push(parentId, ...plan.nodes.map((node) => node.id));
  }
  return affected;
}

export const insertSubtree = defineCommand({
  name: "insertSubtree",
  description: {
    id: "Sisipkan potongan tree (ID sementara tmp_*) ke container; mengembalikan peta tmp_* → ID asli.",
    en: "Insert a tree fragment (temporary tmp_* IDs) into a container; returns the tmp_* → real ID map.",
  },
  aiExposed: true,
  input: z.strictObject({
    parentId: NodeIdSchema,
    index: z.number().int().nonnegative().optional(),
    subtree: SubtreeSchema,
  }),
  run(ctx, input) {
    const parent = nodesMap(ctx.doc).get(input.parentId);
    if (!parent) {
      return fail(
        "NOT_FOUND",
        { id: `Parent "${input.parentId}" tidak ditemukan`, en: `Parent "${input.parentId}" not found` },
        ["parentId"],
      );
    }
    const plan = planSubtree(ctx, input.parentId, input.subtree);
    if ("ok" in plan) return plan;
    const placement = { parentId: input.parentId, index: input.index ?? Number.POSITIVE_INFINITY, plan };
    const limitError = checkPlacements(ctx, [placement]);
    if (limitError) return limitError;
    const affected = writePlacements(ctx, [placement]);
    return { ok: true, value: { idMap: plan.idMap }, affected };
  },
});

export const duplicateNodes = defineCommand({
  name: "duplicateNodes",
  description: {
    id: "Duplikasi node beserta turunannya tepat setelah aslinya; selalu ID baru, rujukan internal di-remap.",
    en: "Duplicate nodes with their descendants right after the originals; always new IDs, internal refs remapped.",
  },
  aiExposed: true,
  input: z.strictObject({
    ids: z.array(NodeIdSchema).min(1),
    // Geser posisi salinan yang `absolute` (paste di tempat lain / Alt-drag).
    offset: z.strictObject({ x: z.number().finite(), y: z.number().finite() }).optional(),
  }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    for (const [i, id] of input.ids.entries()) {
      const yNode = nodes.get(id);
      if (!yNode)
        return fail("NOT_FOUND", { id: `Node "${id}" tidak ditemukan`, en: `Node "${id}" not found` }, ["ids", i]);
      if (nodeType(yNode) === "page") {
        return fail(
          "INVALID_TARGET",
          { id: "Page diduplikasi lewat createPage", en: "Pages are duplicated via createPage" },
          ["ids", i],
        );
      }
    }
    // Node yang ancestor-nya ikut dipilih sudah tercakup salinan ancestor tersebut.
    const selected = new Set(input.ids);
    const roots = [...selected].filter((id) => {
      for (let parent = parentIdOf(nodes.get(id) as YNode); parent; parent = parentIdOf(nodes.get(parent) as YNode)) {
        if (selected.has(parent)) return false;
      }
      return true;
    });

    const reserved = new Set<string>();
    const placements: Placement[] = [];
    const idMap: Record<string, string> = {};
    for (const rootId of roots) {
      const yRoot = nodes.get(rootId) as YNode;
      const parentId = parentIdOf(yRoot) as string;
      const subtreeNodes: Record<string, JsonRecord> = {};
      for (const id of collectSubtree(nodes, rootId)) {
        const json = yNodeToJson(nodes.get(id) as YNode);
        // Anchor publik unik per page: salinan tidak membawa htmlId (DM-008).
        delete json.htmlId;
        subtreeNodes[id] = json;
      }
      const root = subtreeNodes[rootId];
      const position = (root?.style as { base?: { position?: { type?: string; x?: number; y?: number } } })?.base
        ?.position;
      if (input.offset && position?.type === "absolute") {
        position.x = (position.x ?? 0) + input.offset.x;
        position.y = (position.y ?? 0) + input.offset.y;
      }
      const plan = planSubtree(ctx, parentId, { rootIds: [rootId], nodes: subtreeNodes }, reserved);
      if ("ok" in plan) return plan;
      Object.assign(idMap, plan.idMap);
      const siblings = childrenOf(nodes.get(parentId) as YNode)?.toArray() ?? [];
      // Setelah aslinya; salinan lain di parent yang sama ikut menggeser posisi.
      const index =
        siblings.indexOf(rootId) +
        1 +
        placements.filter((p) => p.parentId === parentId && p.index <= siblings.indexOf(rootId) + 1).length;
      placements.push({ parentId, index, plan });
    }

    const limitError = checkPlacements(ctx, placements);
    if (limitError) return limitError;
    const affected = writePlacements(ctx, placements);
    return { ok: true, value: { idMap }, affected };
  },
});
