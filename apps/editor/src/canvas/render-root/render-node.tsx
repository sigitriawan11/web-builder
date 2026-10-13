import { type Breakpoint, type Node, resolveStyle, type SiteDocument, type Style } from "@platform/document-model";
import { type CSSProperties, createElement, Fragment, type ReactElement, type ReactNode, type Ref } from "react";
import { assetUrl } from "./asset-url";
import { renderRichText } from "./rich-text";
import { childLayoutOf, type ParentLayout, styleToCss } from "./style-to-css";

// SEMENTARA (spike M0, T0.4.1): renderer prototipe di editor. Renderer sungguhan dipindah ke
// `packages/renderer` (mode editor & publish, satu sumber) di M1 (T1.10.x).

// Reset agar tag semantik (h1, p, …) tidak membawa margin bawaan browser.
const BASE_CSS: CSSProperties = { boxSizing: "border-box", margin: 0 };

import { DESKTOP_FRAME } from "./breakpoint-context";

export interface RenderNodeContext {
  // Style efektif node di breakpoint frame (hasil `resolveStyle`).
  style: Style;
  parent: ParentLayout;
  // Lebar artboard frame; dipakai node page.
  frameWidth: number;
  // Elemen DOM node untuk geometry store (ED-019); tidak ada di render statis.
  ref?: Ref<Element> | undefined;
}

/**
 * Elemen DOM satu node; `children` = elemen anak yang sudah dirender pemanggil.
 * Dipakai bersama oleh render statis (`renderNode`) dan render inkremental (`NodeView`)
 * agar keduanya selalu menghasilkan HTML yang sama.
 */
export function renderNodeElement(node: Node, context: RenderNodeContext, children: ReactNode): ReactElement {
  const { style, parent, frameWidth } = context;
  const css: CSSProperties = {
    ...BASE_CSS,
    ...styleToCss(style, parent),
    // Hide global (mata di layer panel) menang atas display dari layout.
    ...(node.visible ? {} : { display: "none" }),
  };
  const common = { "data-node-id": node.id, ...(context.ref ? { ref: context.ref } : {}) };

  switch (node.type) {
    case "page":
      return createElement(node.tag ?? "main", { ...common, style: { ...css, width: frameWidth } }, children);
    case "frame": {
      // DM-011: clipContent = alias editor untuk overflow hidden; anak yang terpotong juga tidak bisa diklik (ED-020).
      const frameCss = node.props.clipContent ? { ...css, overflow: "hidden" } : css;
      return createElement(node.tag ?? "div", { ...common, style: frameCss }, children);
    }
    case "text": {
      const { content, style } = renderRichText(node.props.content);
      // `children` dipakai editor teks inline (ED-115) untuk menggantikan isi hasil render.
      return createElement(node.tag ?? "p", { ...common, style: { ...css, ...style } }, children ?? content);
    }
    case "image": {
      const { image, fit, decorative, loading } = node.props;
      const focal = image.focalPoint;
      return createElement("img", {
        ...common,
        src: assetUrl(image.assetId),
        alt: decorative ? "" : (image.alt ?? ""),
        loading: loading ?? "lazy",
        draggable: false,
        style: {
          ...css,
          display: node.visible ? "block" : "none",
          objectFit: fit,
          ...(focal ? { objectPosition: `${focal.x * 100}% ${focal.y * 100}%` } : {}),
        },
      });
    }
  }
}

/**
 * Render statis satu node beserta turunannya langsung dari JSON dokumen (DM-001).
 * Dipakai untuk snapshot test & pembanding; canvas memakai `NodeView` (inkremental).
 */
export function renderNode(
  doc: SiteDocument,
  id: string,
  parent: ParentLayout = "block",
  frame: { breakpoint: Breakpoint; width: number } = DESKTOP_FRAME,
): ReactElement | null {
  const node = doc.nodes[id];
  if (!node) return null;
  const style = resolveStyle(node.style, frame.breakpoint);
  const childLayout = childLayoutOf(style);
  const children =
    "children" in node
      ? node.children.map((childId) => (
          <Fragment key={childId}>{renderNode(doc, childId, childLayout, frame)}</Fragment>
        ))
      : null;
  return renderNodeElement(node, { style, parent, frameWidth: frame.width }, children);
}
