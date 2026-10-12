import { memo } from "react";
import { useNode } from "../../document/use-node";
import { renderProbe } from "./render-probe";
import { renderNodeElement } from "./render-node";
import { childLayoutOf, type ParentLayout } from "./style-to-css";

interface NodeViewProps {
  id: string;
  parent: ParentLayout;
}

/**
 * ED-018: satu komponen per node. Perubahan isi node hanya me-render NodeView node itu;
 * perubahan `children` hanya me-render parent. `memo` mencegah anak ikut render ulang.
 */
// Fungsi dalam sengaja tidak bernama `NodeView`: nama itu akan membayangi konstanta `memo` di bawah,
// sehingga anak dirender lewat versi tanpa memo dan selalu ikut render ulang.
export const NodeView = memo(function NodeViewRender({ id, parent }: NodeViewProps) {
  const node = useNode(id);
  renderProbe.onNodeRender?.(id);
  if (!node) return null;

  const childLayout = childLayoutOf(node.style.base);
  const children =
    "children" in node ? node.children.map((childId) => <NodeView key={childId} id={childId} parent={childLayout} />) : null;
  return renderNodeElement(node, parent, children);
});
