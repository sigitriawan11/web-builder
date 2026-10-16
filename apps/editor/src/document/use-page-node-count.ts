import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { NodeStore } from "./node-store";

/** Jumlah node subtree page (termasuk page) — indikator batas DM-076 di bottom bar. */
export function countPageNodes(store: NodeStore, pageId: string): number {
  let count = 0;
  const stack = [pageId];
  while (stack.length > 0) {
    const node = store.getNode(stack.pop() as string);
    if (!node) continue;
    count++;
    if ("children" in node) stack.push(...node.children);
  }
  return count;
}

/** Dihitung ulang paling sering sekali per frame setelah transaksi dokumen. */
export function usePageNodeCount(doc: Y.Doc, store: NodeStore, pageId: string): number {
  const [count, setCount] = useState(() => countPageNodes(store, pageId));
  useEffect(() => {
    let frame = 0;
    const recount = () => {
      frame = 0;
      setCount(countPageNodes(store, pageId));
    };
    recount();
    const onTransaction = () => {
      if (frame === 0) frame = requestAnimationFrame(recount);
    };
    doc.on("afterTransaction", onTransaction);
    return () => {
      doc.off("afterTransaction", onTransaction);
      cancelAnimationFrame(frame);
    };
  }, [doc, store, pageId]);
  return count;
}
