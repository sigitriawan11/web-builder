import { applyStylePatch, resolveStyle } from "@platform/document-model";
import { memo, useCallback, useContext, useMemo } from "react";
import { useStore } from "zustand";
import { useNode } from "../../document/use-node";
import { previewStore } from "../../store/preview-store";
import { textEditingStore } from "../../store/text-editing-store";
import { GeometryContext } from "../geometry/geometry-context";
import { InlineTextEditor } from "../text-editing/InlineTextEditor";
import { FrameContext } from "./breakpoint-context";
import { renderNodeElement } from "./render-node";
import { renderProbe } from "./render-probe";
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
  // ED-024: override sementara selama drag; selector per node agar hanya node itu yang render ulang.
  const preview = useStore(previewStore, (state) => state.styles[id]);
  const style = useMemo(() => {
    if (!node) return null;
    const resolved = resolveStyle(node.style, frame.breakpoint);
    return preview ? applyStylePatch(resolved, preview) : resolved;
  }, [node, frame.breakpoint, preview]);
  const geometry = useContext(GeometryContext);
  // ED-019: elemen didaftarkan ke geometry store selama ter-mount (cleanup ref callback React 19).
  const ref = useCallback(
    (element: Element | null) => {
      if (!geometry || !element) return;
      geometry.register(id, element);
      return () => geometry.unregister(id);
    },
    [geometry, id],
  );
  renderProbe.onNodeRender?.(id);
  if (!node || !style) return null;

  const context = { style, parent, frameWidth: frame.width, ref: geometry ? ref : undefined };
  if (node.type === "text") {
    return renderNodeElement(node, context, editing ? <InlineTextEditor nodeId={id} /> : null);
  }
  const childLayout = childLayoutOf(style);
  const children =
    "children" in node
      ? node.children.map((childId) => <NodeView key={childId} id={childId} parent={childLayout} />)
      : null;
  return renderNodeElement(node, context, children);
});
