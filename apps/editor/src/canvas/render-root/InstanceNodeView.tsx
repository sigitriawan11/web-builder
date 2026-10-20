import {
  type Breakpoint,
  type ComponentDefinition,
  type InstanceProps,
  type Node,
  type ResolvedNode,
  resolveInstance,
  resolveStyle,
  type Theme,
} from "@platform/document-model";
import {
  childLayoutOf,
  childRenderEnv,
  type ParentLayout,
  type RenderEnv,
  renderNodeElement,
} from "@platform/renderer";
import { useLibraryComponentDefinition } from "@platform/sdk/react";
import type { Ref } from "react";
import type { NodeStore } from "../../document/node-store";
import { assetUrl } from "./asset-url";
import { editorNodeStyle } from "./editor-style";

// T3.4.2 L6 (CMP-011/Option A): render instance di canvas editor. Definisi di-fetch (draft version 0 / published) lalu
// `resolveInstance` → subtree ter-resolve dirender read-only (interior tak diedit di tempat — seperti Figma); hanya
// node instance yang bisa dipilih (membawa `data-node-id` + ref geometry). Instance bersarang yang tak ter-resolve →
// placeholder (resolveInstance menandai `missingComponent`).
interface InstanceNodeViewProps {
  node: Node & { type: "instance" };
  env: RenderEnv;
  theme: Theme;
  breakpoint: Breakpoint;
  parent: ParentLayout;
  frameWidth: number;
  store: NodeStore | null;
  geometryRef: Ref<Element> | undefined;
}

export function InstanceNodeView({
  node,
  env,
  theme,
  breakpoint,
  parent,
  frameWidth,
  store,
  geometryRef,
}: InstanceNodeViewProps) {
  const { componentId, version } = node.props as InstanceProps;
  const def = useLibraryComponentDefinition(componentId, version).data as ComponentDefinition | undefined;

  // Node instance bisa dipilih sebagai satu unit (data-node-id + ref geometry pada elemen akar yang dirender).
  const rootAttrs: Record<string, unknown> = {
    "data-node-id": node.id,
    "data-instance-id": node.id,
    ...(geometryRef ? { ref: geometryRef } : {}),
  };

  // Belum termuat / tidak ada → kotak instance (placeholder) yang tetap bisa dipilih.
  if (!def) {
    const style = resolveStyle(node.style, breakpoint, { theme });
    const css = editorNodeStyle(node, style, { parent, theme, assetUrl, frameWidth });
    const nodeEnv: RenderEnv = { ...env, ctx: { ...env.ctx, nodeAttributes: () => ({ ...rootAttrs, style: css }) } };
    return renderNodeElement(node, nodeEnv, null);
  }

  const resolved = resolveInstance(node, {
    getComponent: (cid, v) => (cid === componentId && v === version ? def : undefined),
    siteNode: (nid) => store?.getNode(nid) ?? undefined,
  });
  return (
    <ResolvedNodeView
      resolved={resolved}
      env={env}
      theme={theme}
      breakpoint={breakpoint}
      parent={parent}
      frameWidth={frameWidth}
      rootAttrs={rootAttrs}
    />
  );
}

interface ResolvedNodeViewProps {
  resolved: ResolvedNode;
  env: RenderEnv;
  theme: Theme;
  breakpoint: Breakpoint;
  parent: ParentLayout;
  frameWidth: number;
  // Atribut elemen akar (hanya di akar subtree instance): data-node-id instance + ref geometry.
  rootAttrs?: Record<string, unknown> | undefined;
}

function ResolvedNodeView({ resolved, env, theme, breakpoint, parent, frameWidth, rootAttrs }: ResolvedNodeViewProps) {
  if (!resolved.visible) return null;
  const asNode = resolved as unknown as Node;
  const style = resolveStyle(resolved.style, breakpoint, { theme });
  const css = editorNodeStyle(asNode, style, { parent, theme, assetUrl, frameWidth });
  const attrs = rootAttrs ? { ...rootAttrs, style: css } : { "data-resolved-id": resolved.id, style: css };
  const nodeEnv: RenderEnv = { ...env, ctx: { ...env.ctx, nodeAttributes: () => attrs } };
  const childLayout = childLayoutOf(style);
  const childEnv = childRenderEnv(asNode, nodeEnv);
  const children = resolved.children?.length
    ? resolved.children.map((child) => (
        <ResolvedNodeView
          key={child.id}
          resolved={child}
          env={childEnv}
          theme={theme}
          breakpoint={breakpoint}
          parent={childLayout}
          frameWidth={frameWidth}
        />
      ))
    : null;
  return renderNodeElement(asNode, nodeEnv, children);
}
