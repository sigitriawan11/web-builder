import type { Block, Inline, Mark, RichTextDoc } from "@platform/document-model";
import { type CSSProperties, Fragment, type ReactNode } from "react";
import { colorToCss, lengthToCss } from "./style-to-css";

// Prototipe canvas (M0) — renderer rich text final & aman (escaping, sanitasi link) di @platform/renderer (T1.10.6).
// Di canvas editor link TIDAK bisa diklik (hanya ditandai garis bawah).

function textStyleCss(attrs: Extract<Mark, { type: "textStyle" }>["attrs"]): CSSProperties {
  return {
    ...(attrs.color ? { color: colorToCss(attrs.color) } : {}),
    ...(attrs.fontWeight ? { fontWeight: attrs.fontWeight } : {}),
    ...(attrs.fontSize ? { fontSize: lengthToCss(attrs.fontSize) } : {}),
    ...(typeof attrs.fontFamily === "string" ? { fontFamily: attrs.fontFamily } : {}),
  };
}

function wrapMark(content: ReactNode, mark: Mark): ReactNode {
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
      return <span style={{ textDecoration: "underline" }}>{content}</span>;
    case "textStyle":
      return <span style={textStyleCss(mark.attrs)}>{content}</span>;
  }
}

// Mark dibungkus dari dalam ke luar sesuai urutan di array.
function wrapMarks(content: ReactNode, marks: readonly Mark[]): ReactNode {
  return marks.reduce<ReactNode>((inner, mark) => wrapMark(inner, mark), content);
}

function renderInline(inline: Inline): ReactNode {
  return inline.type === "hardBreak" ? <br /> : wrapMarks(inline.text, inline.marks ?? []);
}

function renderInlines(content: readonly Inline[] | undefined): ReactNode[] {
  return (content ?? []).map((inline, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: potongan rich text tidak punya ID stabil; seluruh isi dirender ulang bersama.
    <Fragment key={index}>{renderInline(inline)}</Fragment>
  ));
}

export function blockAlign(block: Block): CSSProperties {
  const align = block.type === "paragraph" || block.type === "heading" ? block.attrs?.align : undefined;
  return align ? { textAlign: align } : {};
}

function renderBlock(block: Block, key: number): ReactNode {
  if (block.type === "bulletList" || block.type === "orderedList") {
    const List = block.type === "bulletList" ? "ul" : "ol";
    return (
      <List key={key} style={{ margin: 0, paddingLeft: "1.5em" }}>
        {block.content.map((item, itemIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: item list tidak punya ID stabil.
          <li key={itemIndex}>{item.content.map(renderBlock)}</li>
        ))}
      </List>
    );
  }
  return (
    <span key={key} style={{ display: "block", ...blockAlign(block) }}>
      {block.content?.length ? renderInlines(block.content) : <br />}
    </span>
  );
}

/**
 * Isi node text (DM-013). Satu paragraf/heading (kasus umum) dirender langsung di dalam elemen node
 * agar HTML tetap valid untuk tag seperti `<p>`/`<h1>`; selain itu blok dirender sebagai `<span>` blok / list.
 */
export function renderRichText(doc: RichTextDoc): { content: ReactNode; style: CSSProperties } {
  const [first, ...rest] = doc.content;
  if (first && rest.length === 0 && (first.type === "paragraph" || first.type === "heading")) {
    return { content: renderInlines(first.content), style: blockAlign(first) };
  }
  return { content: doc.content.map(renderBlock), style: {} };
}
