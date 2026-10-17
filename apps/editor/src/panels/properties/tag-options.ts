import type { Node } from "@platform/document-model";

// ED-218: tag HTML semantik yang boleh dipilih user per tipe node (cermin enum schema DM-009). Tipe dengan satu tag
// (image/shape/icon/page) tidak bisa diganti dari UI. Diuji agar tetap sinkron dengan schema (setTag menolak lainnya).
export const TAG_OPTIONS: Partial<Record<Node["type"], readonly string[]>> = {
  frame: ["div", "section", "header", "footer", "nav", "article", "aside", "main", "ul", "ol", "li", "figure"],
  text: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "blockquote", "li", "label", "figcaption"],
};

export const tagOptionsFor = (type: Node["type"]): readonly string[] | undefined => TAG_OPTIONS[type];
