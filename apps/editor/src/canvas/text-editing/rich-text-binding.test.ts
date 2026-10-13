import {
  type RichTextDoc,
  RichTextDocSchema,
  richTextToYXmlFragment,
  yXmlFragmentToRichText,
} from "@platform/document-model";
import { getSchema } from "@tiptap/react";
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { richTextExtensions } from "./rich-text-extensions";

// T0.8.5: konversi milik document-model (tanpa ProseMirror) harus menulis & membaca format yang sama
// dengan binding y-tiptap yang dipakai editor teks; jika tidak, teks rusak saat mulai/selesai diedit.

const schema = getSchema(richTextExtensions);

// Tanpa `align`: Tiptap prototipe belum memakai extension TextAlign (catatan T0.8.5).
const SAMPLE: RichTextDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Judul" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Kue " },
        { type: "text", text: "lembut", marks: [{ type: "bold" }, { type: "italic" }] },
        { type: "hardBreak" },
        { type: "text", text: "dan ", marks: [{ type: "underline" }] },
        { type: "text", text: "murah", marks: [{ type: "strike" }] },
      ],
    },
    { type: "paragraph" },
  ],
};

function attach(fragment: Y.XmlFragment): Y.XmlFragment {
  const doc = new Y.Doc();
  doc.getMap("root").set("content", fragment);
  return fragment;
}

describe("kompatibilitas encoding rich text dengan y-tiptap", () => {
  it("fragment buatan document-model dibaca y-tiptap sebagai dokumen ProseMirror yang sama", () => {
    const fragment = attach(richTextToYXmlFragment(SAMPLE));
    expect(schema.nodeFromJSON(yXmlFragmentToProsemirrorJSON(fragment)).toJSON()).toEqual(
      schema.nodeFromJSON(SAMPLE).toJSON(),
    );
  });

  it("fragment tulisan y-tiptap dibaca document-model tanpa kehilangan isi", () => {
    const doc = new Y.Doc();
    const fragment = prosemirrorJSONToYXmlFragment(schema, SAMPLE, doc.getXmlFragment("content"));
    expect(RichTextDocSchema.parse(yXmlFragmentToRichText(fragment))).toEqual(SAMPLE);
  });
});
