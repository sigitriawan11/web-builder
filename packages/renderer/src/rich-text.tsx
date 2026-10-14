import type { Block, Inline, LinkValue, Mark, RichTextDoc } from "@platform/document-model";
import { type CSSProperties, createElement, Fragment, type ReactNode } from "react";
import { colorToCss, cssString, lengthToCss, tokenVar } from "./css/values";
import type { LinkAttributes } from "./links";

// DM-013 / PUB-044: rich text dari node & mark yang DIIZINKAN saja (whitelist); teks selalu di-escape React, tanpa
// dangerouslySetInnerHTML. Renderer bisa menerima dokumen yang belum tervalidasi (pertahanan berlapis, ARCHITECTURE
// §12): tipe tak dikenal dibuang, atribut dicek bentuknya, nilai CSS lewat helper yang menetralkan nilai asing.

// `null` = link tidak boleh dirender sebagai <a> (sudah di dalam link lain, DM-009) → <span>.
export type LinkRenderer = (link: LinkValue) => LinkAttributes | Record<string, unknown> | null;

const ALIGN = new Set(["left", "center", "right", "justify"]);
const HEADING_LEVELS = new Set([1, 2, 3, 4, 5, 6]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isTokenRef = (value: unknown): value is { $token: string } => isRecord(value) && typeof value.$token === "string";

function textStyle(attrs: unknown): CSSProperties {
  if (!isRecord(attrs)) return {};
  const style: CSSProperties = {};
  if (typeof attrs.color === "string" || isTokenRef(attrs.color)) style.color = colorToCss(attrs.color as never);
  if (typeof attrs.fontWeight === "number" && attrs.fontWeight >= 100 && attrs.fontWeight <= 900) {
    style.fontWeight = Math.round(attrs.fontWeight / 100) * 100;
  }
  if (isRecord(attrs.fontSize)) style.fontSize = lengthToCss(attrs.fontSize as never);
  if (typeof attrs.fontFamily === "string") style.fontFamily = cssString(attrs.fontFamily);
  else if (isTokenRef(attrs.fontFamily)) style.fontFamily = tokenVar(attrs.fontFamily);
  return style;
}

function wrapMark(content: ReactNode, mark: Mark, link: LinkRenderer): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{content}</strong>;
    case "italic":
      return <em>{content}</em>;
    case "underline":
      return <u>{content}</u>;
    case "strike":
      return <s>{content}</s>;
    case "link": {
      const attributes = isRecord(mark.attrs) && isRecord(mark.attrs.link) ? link(mark.attrs.link as LinkValue) : null;
      return attributes ? createElement("a", attributes, content) : <span>{content}</span>;
    }
    case "textStyle":
      return <span style={textStyle(mark.attrs)}>{content}</span>;
    default:
      // Mark tak dikenal: isi tetap tampil (sebagai teks ter-escape), mark-nya dibuang.
      return content;
  }
}

function renderInline(inline: Inline, link: LinkRenderer): ReactNode {
  if (inline.type === "hardBreak") return <br />;
  if (inline.type !== "text" || typeof inline.text !== "string") return null;
  const marks = Array.isArray(inline.marks) ? inline.marks : [];
  return marks.reduce<ReactNode>((inner, mark) => (isRecord(mark) ? wrapMark(inner, mark, link) : inner), inline.text);
}

function renderInlines(content: readonly Inline[] | undefined, link: LinkRenderer): ReactNode[] {
  if (!Array.isArray(content)) return [];
  return content.map((inline, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: potongan rich text tidak punya ID stabil; dirender ulang bersama.
    <Fragment key={index}>{typeof inline === "object" && inline !== null ? renderInline(inline, link) : null}</Fragment>
  ));
}

function alignStyle(block: Block): CSSProperties | undefined {
  const align =
    (block.type === "paragraph" || block.type === "heading") && isRecord(block.attrs) ? block.attrs.align : undefined;
  return typeof align === "string" && ALIGN.has(align) ? { textAlign: align as CSSProperties["textAlign"] } : undefined;
}

function renderBlock(block: Block, key: number, link: LinkRenderer): ReactNode {
  if (!isRecord(block)) return null;
  switch (block.type) {
    case "bulletList":
    case "orderedList": {
      const start = block.type === "orderedList" && isRecord(block.attrs) ? block.attrs.start : undefined;
      const startAttr = Number.isInteger(start) && start !== 1 ? { start } : {};
      const items = Array.isArray(block.content) ? block.content : [];
      return createElement(
        block.type === "bulletList" ? "ul" : "ol",
        { key, ...startAttr },
        items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: item list tidak punya ID stabil.
          <li key={index}>
            {isRecord(item) && item.type === "listItem" && Array.isArray(item.content)
              ? item.content.map((child, childIndex) => renderBlock(child, childIndex, link))
              : null}
          </li>
        )),
      );
    }
    case "paragraph":
    case "heading": {
      const style = alignStyle(block);
      const level = block.type === "heading" && isRecord(block.attrs) ? block.attrs.level : undefined;
      return (
        <span
          key={key}
          data-block={block.type === "heading" && HEADING_LEVELS.has(level as number) ? `h${level}` : block.type}
          style={{ display: "block", ...style }}
        >
          {Array.isArray(block.content) && block.content.length > 0 ? renderInlines(block.content, link) : <br />}
        </span>
      );
    }
    default:
      // Blok tak dikenal (mis. hasil sisipan mentah) tidak dirender.
      return null;
  }
}

/**
 * Isi node text. Satu paragraf/heading (kasus umum) dirender langsung di elemen node agar HTML tetap valid untuk
 * `<p>`/`<h1>`; selain itu blok dirender sebagai `<span>` blok / list.
 */
export function renderRichText(doc: RichTextDoc, link: LinkRenderer): { content: ReactNode; style?: CSSProperties } {
  const blocks = isRecord(doc) && Array.isArray(doc.content) ? doc.content : [];
  const [first, ...rest] = blocks;
  if (first && rest.length === 0 && isRecord(first) && (first.type === "paragraph" || first.type === "heading")) {
    const style = alignStyle(first);
    return { content: renderInlines(first.content, link), ...(style ? { style } : {}) };
  }
  return { content: blocks.map((block, index) => renderBlock(block, index, link)) };
}
