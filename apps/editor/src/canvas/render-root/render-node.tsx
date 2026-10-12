import type { SiteDocument } from "@platform/document-model";
import { type CSSProperties, createElement, type ReactElement } from "react";
import { assetUrl } from "./asset-url";
import { renderRichText } from "./rich-text";
import { childLayoutOf, type ParentLayout, styleToCss } from "./style-to-css";

// SEMENTARA (spike M0, T0.4.1): renderer prototipe di editor. Renderer sungguhan dipindah ke
// `packages/renderer` (mode editor & publish, satu sumber) di M1 (T1.10.x).

// Reset agar tag semantik (h1, p, …) tidak membawa margin bawaan browser.
const BASE_CSS: CSSProperties = { boxSizing: "border-box", margin: 0 };

// DM-010: lebar artboard desktop default (page.props.canvas.width belum ada di schema prototipe).
const PAGE_CANVAS_WIDTH = 1440;

function renderChildren(doc: SiteDocument, ids: readonly string[], parent: ParentLayout): (ReactElement | null)[] {
  return ids.map((childId) => renderNode(doc, childId, parent));
}

/**
 * Render satu node (dan turunannya) menjadi elemen React. Hanya membaca `doc` (DM-001).
 * Setiap elemen node diberi `data-node-id` untuk hit-test & overlay editor (ED-017).
 */
export function renderNode(doc: SiteDocument, id: string, parent: ParentLayout = "block"): ReactElement | null {
  const node = doc.nodes[id];
  if (!node) return null;

  const css: CSSProperties = {
    ...BASE_CSS,
    ...styleToCss(node.style.base, parent),
    // Hide global (mata di layer panel) menang atas display dari layout.
    ...(node.visible ? {} : { display: "none" }),
  };
  const common = { key: node.id, "data-node-id": node.id };
  const childLayout = childLayoutOf(node.style.base);

  switch (node.type) {
    case "page":
      return createElement(
        node.tag ?? "main",
        { ...common, style: { ...css, width: PAGE_CANVAS_WIDTH } },
        renderChildren(doc, node.children, childLayout),
      );
    case "frame":
      return createElement(node.tag ?? "div", { ...common, style: css }, renderChildren(doc, node.children, childLayout));
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
