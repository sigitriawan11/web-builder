import type { Node, SiteDocument } from "@platform/document-model";
import { type CSSProperties, createElement, Fragment, type ReactElement, type ReactNode } from "react";
import { assetUrl } from "./asset-url";
import { renderRichText } from "./rich-text";
import { childLayoutOf, type ParentLayout, styleToCss } from "./style-to-css";

// SEMENTARA (spike M0, T0.4.1): renderer prototipe di editor. Renderer sungguhan dipindah ke
// `packages/renderer` (mode editor & publish, satu sumber) di M1 (T1.10.x).

// Reset agar tag semantik (h1, p, …) tidak membawa margin bawaan browser.
const BASE_CSS: CSSProperties = { boxSizing: "border-box", margin: 0 };

// DM-010: lebar artboard desktop default (page.props.canvas.width belum ada di schema prototipe).
const PAGE_CANVAS_WIDTH = 1440;

/**
 * Elemen DOM satu node; `children` = elemen anak yang sudah dirender pemanggil.
 * Dipakai bersama oleh render statis (`renderNode`) dan render inkremental (`NodeView`)
 * agar keduanya selalu menghasilkan HTML yang sama.
 */
export function renderNodeElement(node: Node, parent: ParentLayout, children: ReactNode): ReactElement {
  const css: CSSProperties = {
    ...BASE_CSS,
    ...styleToCss(node.style.base, parent),
    // Hide global (mata di layer panel) menang atas display dari layout.
    ...(node.visible ? {} : { display: "none" }),
  };
  const common = { "data-node-id": node.id };

  switch (node.type) {
    case "page":
      return createElement(node.tag ?? "main", { ...common, style: { ...css, width: PAGE_CANVAS_WIDTH } }, children);
    case "frame":
      return createElement(node.tag ?? "div", { ...common, style: css }, children);
    case "text": {
      const { content, style } = renderRichText(node.props.content);
      return createElement(node.tag ?? "p", { ...common, style: { ...css, ...style } }, content);
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
export function renderNode(doc: SiteDocument, id: string, parent: ParentLayout = "block"): ReactElement | null {
  const node = doc.nodes[id];
  if (!node) return null;
  const childLayout = childLayoutOf(node.style.base);
  const children =
    "children" in node
      ? node.children.map((childId) => <Fragment key={childId}>{renderNode(doc, childId, childLayout)}</Fragment>)
      : null;
  return renderNodeElement(node, parent, children);
}

