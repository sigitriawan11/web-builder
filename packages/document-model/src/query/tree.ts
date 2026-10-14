import type { Node, NodeType, SiteDocument } from "../schema";
import { plainText } from "./rich-text";

// Query baca-saja atas JSON dokumen (ARCHITECTURE §4.2, DM-074 "Query"): dipakai AI tools, renderer, worker, test.
// Editor membaca Y.Doc lewat NodeStore; command menulis lewat `src/commands`.

type DocNodes = Pick<SiteDocument, "nodes">;

// Batas langkah pengaman: dokumen rusak (siklus) tidak boleh membuat loop tak berujung.
const stepLimit = (doc: DocNodes) => Object.keys(doc.nodes).length + 1;

export function findNode(doc: DocNodes, id: string): Node | undefined {
  return doc.nodes[id];
}

/** Rantai ancestor dari parent langsung sampai page (urutan naik); kosong untuk page atau node tak dikenal. */
export function ancestors(doc: DocNodes, id: string): Node[] {
  const chain: Node[] = [];
  let parentId = doc.nodes[id]?.parentId ?? null;
  for (let steps = 0; parentId !== null && steps < stepLimit(doc); steps++) {
    const parent: Node | undefined = doc.nodes[parentId];
    if (!parent) break;
    chain.push(parent);
    parentId = parent.parentId;
  }
  return chain;
}

/** Page tempat node berada (node page → dirinya); `undefined` bila yatim. */
export function pageOf(doc: DocNodes, id: string): string | undefined {
  const node = doc.nodes[id];
  if (!node) return undefined;
  if (node.type === "page") return node.id;
  const top = ancestors(doc, id).at(-1);
  return top?.type === "page" ? top.id : undefined;
}

export interface WalkEntry {
  node: Node;
  depth: number;
  // Index node di `children` parent-nya (0 untuk akar).
  index: number;
}

/**
 * Telusuri subtree depth-first pre-order (urutan DOM). `visit` mengembalikan `false` untuk melewati anak-anak node
 * itu (nilai lain = lanjut). Node yang tercantum tapi tidak ada & siklus dilewati dengan aman.
 */
export function walk(doc: DocNodes, rootId: string, visit: (entry: WalkEntry) => unknown): void {
  const seen = new Set<string>();
  const stack: { id: string; depth: number; index: number }[] = [{ id: rootId, depth: 0, index: 0 }];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const node = doc.nodes[entry.id];
    if (!node) continue;
    if (visit({ node, depth: entry.depth, index: entry.index }) === false) continue;
    if ("children" in node) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ id: node.children[i] as string, depth: entry.depth + 1, index: i });
      }
    }
  }
}

/** Semua turunan (tanpa akar) dalam urutan DOM; `maxDepth` relatif terhadap akar (1 = anak langsung). */
export function descendants(doc: DocNodes, rootId: string, maxDepth = Number.POSITIVE_INFINITY): Node[] {
  const result: Node[] = [];
  walk(doc, rootId, ({ node, depth }) => {
    if (depth > 0) result.push(node);
    return depth < maxDepth;
  });
  return result;
}

export interface FindNodesFilter {
  type?: NodeType;
  // Tidak peka huruf besar/kecil.
  nameContains?: string;
  // Teks polos node teks mengandung (tidak peka huruf besar/kecil).
  text?: string;
  // Batasi ke satu page (default semua page sesuai `pageOrder`).
  pageId?: string;
}

/** Cari node (DM-074 `findNodes`) dalam urutan page lalu urutan DOM. */
export function findNodes(doc: Pick<SiteDocument, "nodes" | "pageOrder">, filter: FindNodesFilter): Node[] {
  const name = filter.nameContains?.toLowerCase();
  const text = filter.text?.toLowerCase();
  const result: Node[] = [];
  for (const pageId of filter.pageId ? [filter.pageId] : doc.pageOrder) {
    walk(doc, pageId, ({ node }) => {
      if (filter.type && node.type !== filter.type) return;
      if (name && !node.name.toLowerCase().includes(name)) return;
      if (text && (node.type !== "text" || !plainText(node.props.content).toLowerCase().includes(text))) return;
      result.push(node);
    });
  }
  return result;
}
