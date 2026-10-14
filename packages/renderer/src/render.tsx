import type { Node, SiteDocument } from "@platform/document-model";
import { Fragment, type ReactElement, type ReactNode } from "react";
import type { RenderContext } from "./context";
import { anchorId, anchorTargets, linkAttributes } from "./links";
import { Box, Image, Link, Text } from "./primitives";
import { renderRichText } from "./rich-text";

// DM-001: dokumen → React murni (tanpa I/O, tanpa state global); output sama untuk input sama.

const DEFAULT_TAG: Record<Node["type"], string> = { page: "main", frame: "div", text: "p", image: "img" };

interface RenderState {
  doc: SiteDocument;
  ctx: RenderContext;
  anchors: Set<string>;
}

function baseAttributes(node: Node, state: RenderState): Record<string, unknown> {
  const { ctx, anchors } = state;
  const className = ctx.className?.(node);
  const a11y = node.a11y;
  const needsId = node.htmlId !== undefined || anchors.has(node.id);
  return {
    // `metadata` (editor/AI) sengaja tidak pernah dirender (DM-008).
    ...(needsId ? { id: anchorId(state.doc, node.id) } : {}),
    ...(className ? { className } : {}),
    ...(a11y?.label ? { "aria-label": a11y.label } : {}),
    ...(a11y?.role ? { role: a11y.role } : {}),
    ...(a11y?.hiddenFromScreenReader ? { "aria-hidden": true } : {}),
    // DM-039: `visible: false` tidak dipublish; di editor tetap ada (disembunyikan) agar bisa dipilih dari layer panel.
    ...(!node.visible ? { hidden: true } : {}),
    ...ctx.nodeAttributes?.(node),
  };
}

function renderChildren(node: Node, state: RenderState): ReactNode {
  if (!("children" in node)) return null;
  return node.children.map((childId) => <Fragment key={childId}>{renderNode(childId, state)}</Fragment>);
}

function renderNode(id: string, state: RenderState): ReactNode {
  const { doc, ctx } = state;
  const node = doc.nodes[id];
  if (!node) return null;
  if (!node.visible && ctx.mode === "publish") return null;
  const attributes = baseAttributes(node, state);
  const link = (value: Parameters<typeof linkAttributes>[0]) => linkAttributes(value, doc, ctx);

  switch (node.type) {
    case "page":
      return (
        <Box tag={node.tag ?? DEFAULT_TAG.page} attributes={attributes}>
          {renderChildren(node, state)}
        </Box>
      );
    case "frame": {
      const children = renderChildren(node, state);
      // DM-011: frame berlink (card/tombol) dirender sebagai <a>.
      if (node.props.link) return <Link attributes={{ ...attributes, ...link(node.props.link) }}>{children}</Link>;
      return (
        <Box tag={node.tag ?? DEFAULT_TAG.frame} attributes={attributes}>
          {children}
        </Box>
      );
    }
    case "text": {
      const { content, style } = renderRichText(node.props.content, link);
      return (
        <Text tag={node.tag ?? DEFAULT_TAG.text} attributes={attributes} style={style}>
          {content}
        </Text>
      );
    }
    case "image": {
      const { image, decorative, loading, link: imageLink } = node.props;
      const entry = doc.assets[image.assetId];
      const focal = image.focalPoint;
      const element = (
        <Image
          attributes={imageLink ? {} : attributes}
          src={ctx.assetUrl(image.assetId)}
          alt={decorative ? "" : (image.alt ?? "")}
          width={entry?.width}
          height={entry?.height}
          loading={loading ?? "lazy"}
          objectPosition={focal ? `${focal.x * 100}% ${focal.y * 100}%` : undefined}
        />
      );
      return imageLink ? <Link attributes={{ ...attributes, ...link(imageLink) }}>{element}</Link> : element;
    }
  }
}

/** Render satu page dokumen (DM-001). `null` bila `ctx.pageId` bukan page di dokumen. */
export function render(doc: SiteDocument, ctx: RenderContext): ReactElement | null {
  const page = doc.nodes[ctx.pageId];
  if (page?.type !== "page") return null;
  return <>{renderNode(ctx.pageId, { doc, ctx, anchors: anchorTargets(doc) })}</>;
}
