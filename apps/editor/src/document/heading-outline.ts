import { type Node, plainText } from "@platform/document-model";

// ED-211: analisis struktur heading sebuah page (tag h1–h6, bukan text style). Dipakai panel Outline (P1) & peringatan
// aksesibilitas: tidak ada H1, lebih dari satu H1, lompatan level (mis. H2 → H4). Murni agar bisa diuji.

export interface HeadingEntry {
  nodeId: string;
  level: number; // 1..6
  text: string;
}

export type HeadingWarning =
  | { type: "noH1" }
  | { type: "multipleH1"; nodeId: string }
  | { type: "levelJump"; nodeId: string; from: number; to: number };

const HEADING_TAG = /^h([1-6])$/;

/** Heading dalam urutan dokumen (DFS mengikuti urutan anak) untuk satu page. */
export function collectHeadings(nodes: Record<string, Node>, pageId: string): HeadingEntry[] {
  const out: HeadingEntry[] = [];
  const visit = (id: string) => {
    const node = nodes[id];
    if (!node) return;
    if (node.type === "text" && node.tag) {
      const match = HEADING_TAG.exec(node.tag);
      if (match) out.push({ nodeId: id, level: Number(match[1]), text: plainText(node.props.content).trim() });
    }
    if ("children" in node) for (const child of node.children) visit(child);
  };
  const page = nodes[pageId];
  if (page && "children" in page) for (const child of page.children) visit(child);
  return out;
}

/** Outline + peringatan aksesibilitas heading (ED-211). */
export function analyzeHeadings(
  nodes: Record<string, Node>,
  pageId: string,
): { outline: HeadingEntry[]; warnings: HeadingWarning[] } {
  const outline = collectHeadings(nodes, pageId);
  const warnings: HeadingWarning[] = [];
  const h1s = outline.filter((entry) => entry.level === 1);
  if (h1s.length === 0) warnings.push({ type: "noH1" });
  for (const extra of h1s.slice(1)) warnings.push({ type: "multipleH1", nodeId: extra.nodeId });
  for (let i = 1; i < outline.length; i++) {
    const prev = outline[i - 1] as HeadingEntry;
    const curr = outline[i] as HeadingEntry;
    if (curr.level - prev.level > 1) {
      warnings.push({ type: "levelJump", nodeId: curr.nodeId, from: prev.level, to: curr.level });
    }
  }
  return { outline, warnings };
}
