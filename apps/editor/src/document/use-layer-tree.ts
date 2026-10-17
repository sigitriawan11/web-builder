import type { Node } from "@platform/document-model";
import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { NodeStore } from "./node-store";

// ED-136 / OPEN 02#4: tree layers dalam urutan Figma = kebalikan urutan dokumen (atas panel = paling depan).
// `children` dokumen tetap urutan DOM; pembalikan hanya untuk tampilan.
export interface LayerNode {
  id: string;
  name: string;
  type: Node["type"];
  visible: boolean;
  locked: boolean;
  // Hanya ada untuk node kontainer (frame/page/section) — react-arborist menganggap node tanpa `children` = leaf.
  children?: LayerNode[];
}

// ED-138: react-arborist memberi index di urutan TAMPILAN (Figma = kebalikan dokumen). Konversi ke index dokumen
// akhir: display 0 (atas) = dokumen terakhir. `remaining` = jumlah anak parent tujuan tanpa node yang ditarik.
export function docDropIndex(remaining: number, displayIndex: number): number {
  return Math.max(0, Math.min(remaining, remaining - displayIndex));
}

export function buildLayerTree(store: NodeStore, pageId: string): LayerNode[] {
  const build = (id: string): LayerNode | null => {
    const node = store.getNode(id);
    if (!node) return null;
    const layer: LayerNode = { id, name: node.name, type: node.type, visible: node.visible, locked: node.locked };
    if ("children" in node) {
      layer.children = node.children
        .slice()
        .reverse()
        .map(build)
        .filter((child): child is LayerNode => child !== null);
    }
    return layer;
  };
  const page = store.getNode(pageId);
  if (!page || !("children" in page)) return [];
  return page.children
    .slice()
    .reverse()
    .map(build)
    .filter((child): child is LayerNode => child !== null);
}

/** Tree layers subtree page, dibangun ulang paling sering sekali per frame setelah transaksi dokumen. */
export function useLayerTree(doc: Y.Doc, store: NodeStore, pageId: string): LayerNode[] {
  const [tree, setTree] = useState(() => buildLayerTree(store, pageId));
  useEffect(() => {
    let frame = 0;
    const rebuild = () => {
      frame = 0;
      setTree(buildLayerTree(store, pageId));
    };
    rebuild();
    const onTransaction = () => {
      if (frame === 0) frame = requestAnimationFrame(rebuild);
    };
    doc.on("afterTransaction", onTransaction);
    return () => {
      doc.off("afterTransaction", onTransaction);
      cancelAnimationFrame(frame);
    };
  }, [doc, store, pageId]);
  return tree;
}
