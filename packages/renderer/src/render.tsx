import type { LinkValue, Node, SiteDocument } from "@platform/document-model";
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
  // DM-009: di dalam <a> (frame berlink) tidak boleh ada elemen interaktif lain → link dalam dirender <span>.
  insideLink: boolean;
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

// Atribut <a>; di dalam link lain → null (dirender <span> tanpa tujuan, DM-009).
function linkOf(value: LinkValue, state: RenderState): Record<string, unknown> | null {
  return state.insideLink ? null : { ...linkAttributes(value, state.doc, state.ctx) };
}

function renderNode(id: string, state: RenderState): ReactNode {
  const { doc, ctx } = state;
  const node = doc.nodes[id];
  if (!node) return null;
  if (!node.visible && ctx.mode === "publish") return null;
  const attributes = baseAttributes(node, state);

  switch (node.type) {
    case "page":
      return (
        <Box tag={node.tag ?? DEFAULT_TAG.page} attributes={attributes}>
          {renderChildren(node, state)}
        </Box>
      );
    case "frame": {
      // DM-011: frame berlink (card/tombol) dirender sebagai <a>; anak-anaknya tidak boleh berisi link lagi.
      const frameLink = node.props.link ? linkOf(node.props.link, state) : null;
      const children = renderChildren(node, frameLink ? { ...state, insideLink: true } : state);
      if (frameLink) return <Link attributes={{ ...attributes, ...frameLink }}>{children}</Link>;
      return (
        <Box tag={node.tag ?? DEFAULT_TAG.frame} attributes={attributes}>
          {children}
        </Box>
      );
    }
    case "text": {
      const { content, style } = renderRichText(node.props.content, (value) => linkOf(value, state));
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
      // Link gambar di dalam link lain → tanpa <a>; atribut node tetap di <img> (DM-009).
      const imageAttributes = imageLink ? linkOf(imageLink, state) : null;
      const element = (
        <Image
          attributes={imageAttributes ? {} : attributes}
          src={ctx.assetUrl(image.assetId)}
          alt={decorative ? "" : (image.alt ?? "")}
          width={entry?.width}
          height={entry?.height}
          loading={loading ?? "lazy"}
          objectPosition={focal ? `${focal.x * 100}% ${focal.y * 100}%` : undefined}
        />
      );
      return imageAttributes ? <Link attributes={{ ...attributes, ...imageAttributes }}>{element}</Link> : element;
    }
  }
}

/** Render satu page dokumen (DM-001). `null` bila `ctx.pageId` bukan page di dokumen. */
export function render(doc: SiteDocument, ctx: RenderContext): ReactElement | null {
  const page = doc.nodes[ctx.pageId];
  if (page?.type !== "page") return null;
  return <>{renderNode(ctx.pageId, { doc, ctx, anchors: anchorTargets(doc), insideLink: false })}</>;
}
