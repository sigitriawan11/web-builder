import { memo } from "react";
import { useStore } from "zustand";
import { useNode } from "../../document/use-node";
import { textEditingStore } from "../../store/text-editing-store";
import { InlineTextEditor } from "../text-editing/InlineTextEditor";
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
  // Selector boolean: hanya node yang mulai/selesai diedit yang render ulang.
  const editing = useStore(textEditingStore, (state) => state.editingId === id);
  renderProbe.onNodeRender?.(id);
  if (!node) return null;

  if (node.type === "text") {
    return renderNodeElement(node, parent, editing ? <InlineTextEditor content={node.props.content} /> : null);
  }
  const childLayout = childLayoutOf(node.style.base);
  const children =
    "children" in node ? node.children.map((childId) => <NodeView key={childId} id={childId} parent={childLayout} />) : null;
  return renderNodeElement(node, parent, children);
});
