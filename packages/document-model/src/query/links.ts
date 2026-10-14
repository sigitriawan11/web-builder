import type { SiteDocument } from "../schema";
import { pageOf } from "./tree";
import { walkJsonObjects } from "./walk-json";

// Rujukan link internal (DM-056): link `page` (+ `anchorNodeId`) dan `anchor` di props node — termasuk mark link
// rich text & link image/frame. Dicari generik agar field link baru otomatis ikut diperiksa.

export type LinkRefLocation =
  | { kind: "page"; pageId: string; anchorNodeId?: string; nodeId: string; path: (string | number)[] }
  | { kind: "anchor"; targetId: string; nodeId: string; path: (string | number)[] };

export type BrokenLink = LinkRefLocation & { reason: "PAGE_MISSING" | "ANCHOR_MISSING"; message: string };

export function collectLinkRefs(doc: Pick<SiteDocument, "nodes">): LinkRefLocation[] {
  const found: LinkRefLocation[] = [];
  for (const node of Object.values(doc.nodes)) {
    walkJsonObjects(node.props, ["nodes", node.id, "props"], (value, path) => {
      if (value.type === "page" && typeof value.pageId === "string") {
        found.push({
          kind: "page",
          pageId: value.pageId,
          ...(typeof value.anchorNodeId === "string" ? { anchorNodeId: value.anchorNodeId } : {}),
          nodeId: node.id,
          path: path(),
        });
        return true;
      }
      if (value.type === "anchor" && typeof value.nodeId === "string") {
        found.push({ kind: "anchor", targetId: value.nodeId, nodeId: node.id, path: path() });
        return true;
      }
      return false;
    });
  }
  return found;
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
