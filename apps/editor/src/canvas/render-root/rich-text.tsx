import type { RichTextDoc } from "@platform/document-model";
import { type CSSProperties, Fragment, type ReactNode } from "react";

type Block = RichTextDoc["content"][number];
type Inline = NonNullable<Block["content"]>[number];
type Mark = NonNullable<Extract<Inline, { type: "text" }>["marks"]>[number];

const MARK_TAG: Record<Mark["type"], "strong" | "em" | "u" | "s"> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  strike: "s",
};

// Mark dibungkus dari dalam ke luar sesuai urutan di array.
function wrapMarks(content: ReactNode, marks: readonly Mark[]): ReactNode {
  const [innermost, ...outer] = marks;
  if (!innermost) return content;
  const Tag = MARK_TAG[innermost.type];
  return wrapMarks(<Tag>{content}</Tag>, outer);
}

function renderInline(inline: Inline): ReactNode {
  return inline.type === "hardBreak" ? <br /> : wrapMarks(inline.text, inline.marks ?? []);
}

function renderInlines(content: Block["content"]): ReactNode[] {
  return (content ?? []).map((inline, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: potongan rich text tidak punya ID stabil; seluruh isi dirender ulang bersama.
    <Fragment key={index}>{renderInline(inline)}</Fragment>
  ));
}

export function blockAlign(block: Block): CSSProperties {
  const align = block.attrs?.align;
  return align ? { textAlign: align } : {};
}

/**
 * Isi node text (DM-013). Satu paragraf (kasus umum) dirender langsung di dalam elemen node
 * agar HTML tetap valid untuk tag seperti `<p>`/`<h1>`; beberapa blok dirender sebagai `<span>` blok.
 */
export function renderRichText(doc: RichTextDoc): { content: ReactNode; style: CSSProperties } {
  const [first, ...rest] = doc.content;
  if (first && rest.length === 0) {
    return { content: renderInlines(first.content), style: blockAlign(first) };
  }
  return {
    content: doc.content.map((block, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: blok rich text tidak punya ID stabil; seluruh isi dirender ulang bersama.
      <span key={index} style={{ display: "block", ...blockAlign(block) }}>
        {block.content?.length ? renderInlines(block.content) : <br />}
      </span>
    )),
    style: {},
  };
}
