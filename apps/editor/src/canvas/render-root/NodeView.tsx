import { applyStylePatch, resolveStyle, type Theme } from "@platform/document-model";
import {
  childLayoutOf,
  childRenderEnv,
  type ParentLayout,
  type RenderEnv,
  renderNodeElement,
} from "@platform/renderer";
import { createContext, memo, useCallback, useContext, useMemo } from "react";
import { useStore } from "zustand";
import { useNode } from "../../document/use-node";
import { previewStore } from "../../store/preview-store";
import { textEditingStore } from "../../store/text-editing-store";
import { GeometryContext } from "../geometry/geometry-context";
import { InlineTextEditor } from "../text-editing/InlineTextEditor";
import { assetUrl } from "./asset-url";
import { FrameContext } from "./breakpoint-context";
import { editorNodeStyle } from "./editor-style";
import { RenderEnvContext } from "./render-env";
import { renderProbe } from "./render-probe";

export const ThemeContext = createContext<Theme | null>(null);

interface NodeViewProps {
  id: string;
  parent: ParentLayout;
  // Env dari parent (mis. di dalam frame berlink → `insideLink`); root memakai RenderEnvContext.
  env?: RenderEnv | undefined;
}

/**
 * ED-018: satu komponen per node. Perubahan isi node hanya me-render NodeView node itu;
 * perubahan `children` hanya me-render parent. `memo` mencegah anak ikut render ulang.
 * ED-017: elemen dibuat oleh `@platform/renderer` (sama dengan publish) + atribut editor.
 */
// Fungsi dalam sengaja tidak bernama `NodeView`: nama itu akan membayangi konstanta `memo` di bawah,
// sehingga anak dirender lewat versi tanpa memo dan selalu ikut render ulang.
export const NodeView = memo(function NodeViewRender({ id, parent, env: parentEnv }: NodeViewProps) {
  const node = useNode(id);
  const frame = useContext(FrameContext);
  const theme = useContext(ThemeContext);
  const rootEnv = useContext(RenderEnvContext);
  const env = parentEnv ?? rootEnv;
  // Selector boolean: hanya node yang mulai/selesai diedit yang render ulang.
  const editing = useStore(textEditingStore, (state) => state.editingId === id);
  // ED-024: override sementara selama drag; selector per node agar hanya node itu yang render ulang.
  const preview = useStore(previewStore, (state) => state.styles[id]);
  const style = useMemo(() => {
    if (!node) return null;
    const resolved = resolveStyle(node.style, frame.breakpoint, theme ? { theme } : undefined);
    return preview ? applyStylePatch(resolved, preview) : resolved;
  }, [node, frame.breakpoint, theme, preview]);
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
  // Env anak stabil selama node & env tidak berubah (anak memo tidak ikut render ulang).
  const childEnv = useMemo(() => (node && env ? childRenderEnv(node, env) : null), [node, env]);
  renderProbe.onNodeRender?.(id);
  if (!node || !style || !env || !theme || !childEnv) return null;

  const css = editorNodeStyle(node, style, { parent, theme, assetUrl, frameWidth: frame.width });
  const attributes = {
    "data-node-id": id,
    style: css,
    ...(geometry ? { ref } : {}),
    // Gambar tidak boleh memulai drag HTML5 bawaan browser (bentrok dengan drag canvas).
    ...(node.type === "image" ? { draggable: false } : {}),
  };
  const nodeEnv: RenderEnv = { ...env, ctx: { ...env.ctx, nodeAttributes: () => attributes } };
  if (node.type === "text") {
    return renderNodeElement(node, nodeEnv, null, editing ? { content: <InlineTextEditor nodeId={id} /> } : {});
  }
  const childLayout = childLayoutOf(style);
  const children =
    "children" in node
      ? node.children.map((childId) => <NodeView key={childId} id={childId} parent={childLayout} env={childEnv} />)
      : null;
  return renderNodeElement(node, nodeEnv, children);
});
