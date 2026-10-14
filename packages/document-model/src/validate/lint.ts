import type { Node, SiteDocument } from "../schema";

// Lint semantik DM-009: WARNING (bukan error validasi) — dokumen tetap valid; editor/AI menampilkan saran.

export type LintCode = "MULTIPLE_H1" | "HEADING_SKIP" | "IMAGE_MISSING_ALT";

export interface LintWarning {
  code: LintCode;
  pageId: string;
  nodeId: string;
  message: string;
}

const headingLevel = (node: Node): number | null => {
  if (node.type !== "text" || !node.tag || !/^h[1-6]$/.test(node.tag)) return null;
  return Number(node.tag.slice(1));
};

/** Node page dalam urutan DOM (depth-first mengikuti `children`). */
function* inDomOrder(doc: SiteDocument, pageId: string): Generator<Node> {
  const stack = [pageId];
  while (stack.length > 0) {
    const node = doc.nodes[stack.pop() ?? ""];
    if (!node) continue;
    yield node;
    if ("children" in node) stack.push(...[...node.children].reverse());
  }
}

export function lintDocument(doc: SiteDocument): LintWarning[] {
  const warnings: LintWarning[] = [];
  for (const pageId of doc.pageOrder) {
    let h1Count = 0;
    let previousLevel = 0;
    for (const node of inDomOrder(doc, pageId)) {
      const level = headingLevel(node);
      if (level !== null) {
        if (level === 1 && ++h1Count > 1) {
          warnings.push({ code: "MULTIPLE_H1", pageId, nodeId: node.id, message: "Lebih dari satu h1 di halaman ini" });
        }
        if (previousLevel > 0 && level > previousLevel + 1) {
          warnings.push({
            code: "HEADING_SKIP",
            pageId,
            nodeId: node.id,
            message: `Heading melompat dari h${previousLevel} ke h${level}`,
          });
        }
        previousLevel = level;
      }
      if (node.type === "image" && !node.props.decorative && !node.props.image.alt?.trim()) {
        warnings.push({
          code: "IMAGE_MISSING_ALT",
          pageId,
          nodeId: node.id,
          message: "Gambar tanpa teks alternatif (tandai dekoratif bila hanya hiasan)",
        });
      }
    }
  }
  return warnings;
}
