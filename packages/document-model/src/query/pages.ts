import type { SiteDocument } from "../schema";
import { walk } from "./tree";

// Ringkasan halaman = read model `site_pages` (ARCHITECTURE §5.5/§6.3): dipakai api (situs baru) & realtime
// (extension projections) — satu sumber agar keduanya tidak menyimpang.

export interface PageSummary {
  pageId: string;
  path: string;
  title: string;
  seo: Record<string, unknown> | null;
  // Index di `pageOrder`.
  sortOrder: number;
  isHome: boolean;
  // Jumlah node page ini termasuk page-nya sendiri.
  nodeCount: number;
}

/** Halaman sesuai urutan `pageOrder`; id yang bukan page dilewati. Murni & deterministik. */
export function summarizePages(doc: Pick<SiteDocument, "nodes" | "pageOrder">): PageSummary[] {
  return doc.pageOrder.flatMap((pageId, sortOrder) => {
    const node = doc.nodes[pageId];
    if (node?.type !== "page") return [];
    let nodeCount = 0;
    walk(doc, pageId, () => {
      nodeCount += 1;
    });
    return [
      {
        pageId,
        path: node.props.path,
        title: node.props.title,
        seo: node.props.seo ?? null,
        sortOrder,
        isHome: node.props.isHome === true,
        nodeCount,
      },
    ];
  });
}
