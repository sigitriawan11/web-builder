import type { Node, SiteDocument } from "@platform/document-model";
import { generateLandingDocument } from "@platform/document-model/fixtures";

// Dokumen benchmark 2 page (masing-masing ~`nodeCount` node) untuk mengukur switch page (ED-022: < 500 ms @ 1.000
// node). Page kedua = salinan page pertama dengan ID node yang di-remap (tanpa rujukan antar-node di props, aman).
function remapPage(
  doc: SiteDocument,
  suffix: string,
  pagePath: string,
): { pageId: string; nodes: Record<string, Node> } {
  const map = new Map<string, string>();
  const rename = (id: string) => {
    const existing = map.get(id);
    if (existing) return existing;
    const next = id.startsWith("pg_") ? `pg_bench${suffix}` : `n_b${suffix}${map.size.toString(36).padStart(5, "0")}`;
    map.set(id, next);
    return next;
  };
  for (const id of Object.keys(doc.nodes)) rename(id);
  const nodes: Record<string, Node> = {};
  for (const [id, node] of Object.entries(doc.nodes)) {
    const copy = {
      ...node,
      id: rename(id),
      parentId: node.parentId ? rename(node.parentId) : null,
      ...("children" in node ? { children: node.children.map(rename) } : {}),
    } as Node;
    if (copy.type === "page") copy.props = { ...copy.props, path: pagePath, title: "Bench B", isHome: false };
    nodes[copy.id] = copy;
  }
  return { pageId: rename(doc.pageOrder[0] ?? ""), nodes };
}

export function benchPagesDocument(nodeCount: number): SiteDocument {
  const base = generateLandingDocument({ nodeCount, seed: 1 });
  const second = remapPage(generateLandingDocument({ nodeCount, seed: 2 }), "2", "/bench-b");
  return { ...base, nodes: { ...base.nodes, ...second.nodes }, pageOrder: [...base.pageOrder, second.pageId] };
}
