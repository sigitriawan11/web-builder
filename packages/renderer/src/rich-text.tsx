import type { Block, Inline, LinkValue, Mark, RichTextDoc } from "@platform/document-model";
import { type CSSProperties, createElement, Fragment, type ReactNode } from "react";
import { colorToCss, lengthToCss, tokenVar } from "./css/values";
import type { LinkAttributes } from "./links";

// DM-013: rich text dari node yang diizinkan saja; teks selalu di-escape React (tanpa dangerouslySetInnerHTML).
// Sanitasi & uji XSS lengkap di T1.10.6.

export type LinkRenderer = (link: LinkValue) => LinkAttributes;

function textStyle(attrs: Extract<Mark, { type: "textStyle" }>["attrs"]): CSSProperties {
  return {
    ...(attrs.color ? { color: colorToCss(attrs.color) } : {}),
    ...(attrs.fontWeight ? { fontWeight: attrs.fontWeight } : {}),
    ...(attrs.fontSize ? { fontSize: lengthToCss(attrs.fontSize) } : {}),
    // Nama family literal dikutip (JSON string = kutip ganda + escape) agar spasi/karakter khusus aman.
    ...(attrs.fontFamily
      ? {
          fontFamily:
            typeof attrs.fontFamily === "string" ? JSON.stringify(attrs.fontFamily) : tokenVar(attrs.fontFamily),
        }
      : {}),
  };
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
    case "link":
      return createElement("a", link(mark.attrs.link), content);
    case "textStyle":
      return <span style={textStyle(mark.attrs)}>{content}</span>;
  }
}

function renderInlines(content: readonly Inline[] | undefined, link: LinkRenderer): ReactNode[] {
  return (content ?? []).map((inline, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: potongan rich text tidak punya ID stabil; dirender ulang bersama.
    <Fragment key={index}>
      {inline.type === "hardBreak" ? (
        <br />
      ) : (
        (inline.marks ?? []).reduce<ReactNode>((inner, mark) => wrapMark(inner, mark, link), inline.text)
      )}
    </Fragment>
  ));
}

function alignStyle(block: Block): CSSProperties | undefined {
  const align = block.type === "paragraph" || block.type === "heading" ? block.attrs?.align : undefined;
  return align ? { textAlign: align } : undefined;
}

function renderBlock(block: Block, key: number, link: LinkRenderer): ReactNode {
  if (block.type === "bulletList" || block.type === "orderedList") {
    const tag = block.type === "bulletList" ? "ul" : "ol";
    const start =
      block.type === "orderedList" && block.attrs?.start && block.attrs.start !== 1 ? { start: block.attrs.start } : {};
    return createElement(
      tag,
      { key, ...start },
      block.content.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: item list tidak punya ID stabil.
        <li key={index}>{item.content.map((child, childIndex) => renderBlock(child, childIndex, link))}</li>
      )),
    );
  }
  const style = alignStyle(block);
  return (
    <span key={key} data-block={block.type} style={{ display: "block", ...style }}>
      {block.content?.length ? renderInlines(block.content, link) : <br />}
    </span>
  );
}

/**
 * Isi node text. Satu paragraf/heading (kasus umum) dirender langsung di elemen node agar HTML tetap valid untuk
 * `<p>`/`<h1>`; selain itu blok dirender sebagai `<span>` blok / list.
 */
export function renderRichText(doc: RichTextDoc, link: LinkRenderer): { content: ReactNode; style?: CSSProperties } {
  const [first, ...rest] = doc.content;
  if (first && rest.length === 0 && (first.type === "paragraph" || first.type === "heading")) {
    const style = alignStyle(first);
    return { content: renderInlines(first.content, link), ...(style ? { style } : {}) };
  }
  return { content: doc.content.map((block, index) => renderBlock(block, index, link)) };
}
