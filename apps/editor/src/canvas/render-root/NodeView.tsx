import { resolveStyle } from "@platform/document-model";
import { memo, useContext, useMemo } from "react";
import { useStore } from "zustand";
import { useNode } from "../../document/use-node";
import { textEditingStore } from "../../store/text-editing-store";
import { InlineTextEditor } from "../text-editing/InlineTextEditor";
import { FrameContext } from "./breakpoint-context";
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
  const frame = useContext(FrameContext);
  // Selector boolean: hanya node yang mulai/selesai diedit yang render ulang.
  const editing = useStore(textEditingStore, (state) => state.editingId === id);
  const style = useMemo(() => (node ? resolveStyle(node.style, frame.breakpoint) : null), [node, frame.breakpoint]);
  renderProbe.onNodeRender?.(id);
  if (!node || !style) return null;

  const context = { style, parent, frameWidth: frame.width };
  if (node.type === "text") {
    return renderNodeElement(node, context, editing ? <InlineTextEditor content={node.props.content} /> : null);
  }
  const childLayout = childLayoutOf(style);
  const children =
    "children" in node ? node.children.map((childId) => <NodeView key={childId} id={childId} parent={childLayout} />) : null;
  return renderNodeElement(node, context, children);
});
