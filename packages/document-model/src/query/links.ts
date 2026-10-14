import type { SiteDocument } from "../schema";

// Rujukan link internal (DM-056): link `page` (+ `anchorNodeId`) dan `anchor` di props node — termasuk mark link
// rich text & link image/frame. Dicari generik agar field link baru otomatis ikut diperiksa.

export type LinkRefLocation =
  | { kind: "page"; pageId: string; anchorNodeId?: string; nodeId: string; path: (string | number)[] }
  | { kind: "anchor"; targetId: string; nodeId: string; path: (string | number)[] };

export type BrokenLink = LinkRefLocation & { reason: "PAGE_MISSING" | "ANCHOR_MISSING"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function collectLinkRefs(doc: Pick<SiteDocument, "nodes">): LinkRefLocation[] {
  const found: LinkRefLocation[] = [];
  const visit = (value: unknown, nodeId: string, path: (string | number)[]): void => {
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) visit(item, nodeId, [...path, index]);
      return;
    }
    if (!isRecord(value)) return;
    if (value.type === "page" && typeof value.pageId === "string") {
      found.push({
        kind: "page",
        pageId: value.pageId,
        ...(typeof value.anchorNodeId === "string" ? { anchorNodeId: value.anchorNodeId } : {}),
        nodeId,
        path,
      });
      return;
    }
    if (value.type === "anchor" && typeof value.nodeId === "string") {
      found.push({ kind: "anchor", targetId: value.nodeId, nodeId, path });
      return;
    }
    for (const [key, child] of Object.entries(value)) visit(child, nodeId, [...path, key]);
  };
  for (const node of Object.values(doc.nodes)) visit(node.props, node.id, ["nodes", node.id, "props"]);
  return found;
}

/** Page tempat node berada (naik mengikuti `parentId`); `undefined` bila yatim. */
export function pageOf(doc: Pick<SiteDocument, "nodes">, nodeId: string): string | undefined {
  let current = doc.nodes[nodeId];
  for (let steps = 0; current && steps <= 64; steps++) {
    if (current.type === "page") return current.id;
    current = current.parentId === null ? undefined : doc.nodes[current.parentId];
  }
  return undefined;
}

/**
 * Link internal yang rujukannya hilang: page tidak ada, anchor bukan node di page tujuan / page yang sama.
 * Bukan error schema — page/node bisa dihapus setelah link dibuat; mode validasi (DM-068) menentukan warning/error.
 */
export function findBrokenLinks(doc: Pick<SiteDocument, "nodes" | "pageOrder">): BrokenLink[] {
  const pages = new Set(doc.pageOrder);
  const anchorOk = (targetId: string, pageId: string) => {
    const target = doc.nodes[targetId];
    return target !== undefined && target.type !== "page" && pageOf(doc, targetId) === pageId;
  };
  const broken: BrokenLink[] = [];
  for (const ref of collectLinkRefs(doc)) {
    if (ref.kind === "page") {
      if (!pages.has(ref.pageId)) {
        broken.push({ ...ref, reason: "PAGE_MISSING", message: `Link ke page "${ref.pageId}" yang tidak ada` });
      } else if (ref.anchorNodeId !== undefined && !anchorOk(ref.anchorNodeId, ref.pageId)) {
        broken.push({
          ...ref,
          reason: "ANCHOR_MISSING",
          message: `Anchor "${ref.anchorNodeId}" tidak ada di page "${ref.pageId}"`,
        });
      }
      continue;
    }
    const pageId = pageOf(doc, ref.nodeId);
    if (pageId === undefined || !anchorOk(ref.targetId, pageId)) {
      broken.push({
        ...ref,
        reason: "ANCHOR_MISSING",
        message: `Anchor "${ref.targetId}" tidak ada di page yang sama`,
      });
    }
  }
  return broken;
}
