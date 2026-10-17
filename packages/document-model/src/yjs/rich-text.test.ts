import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { heroDocument } from "../../test/fixtures";
import { type RichTextDoc, RichTextDocSchema } from "../schema";
import { jsonToYDoc, yDocToJson } from "./mapping";
import { richTextToYXmlFragment, yXmlFragmentToRichText } from "./rich-text";

const SAMPLE: RichTextDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2, align: "center" }, content: [{ type: "text", text: "Judul" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Kue " },
        { type: "text", text: "lembut", marks: [{ type: "bold" }, { type: "italic" }] },
        { type: "hardBreak" },
        { type: "text", text: "baris dua" },
      ],
    },
    { type: "paragraph" },
  ],
};

// Fragment harus terpasang di Y.Doc agar isinya bisa dibaca.
function attached(doc: RichTextDoc): { ydoc: Y.Doc; fragment: Y.XmlFragment } {
  const ydoc = new Y.Doc();
  ydoc.getMap("root").set("content", richTextToYXmlFragment(doc));
  const fragment = ydoc.getMap("root").get("content");
  if (!(fragment instanceof Y.XmlFragment)) throw new Error("fragment tidak terpasang");
  return { ydoc, fragment };
}

describe("rich text ↔ Y.XmlFragment (DM-058, T0.8.5)", () => {
  it("round-trip lossless: heading + attrs, mark ganda, hardBreak, paragraf kosong", () => {
    const { fragment } = attached(SAMPLE);
    expect(RichTextDocSchema.parse(yXmlFragmentToRichText(fragment))).toEqual(SAMPLE);
  });

  it("round-trip lossless: list bullet & numbered bersarang (DM-013/ED-121)", () => {
    const list: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Satu" }] }] },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Dua" }] },
                {
                  type: "orderedList",
                  attrs: { start: 3 },
                  content: [
                    { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Nested" }] }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const { fragment } = attached(list);
    expect(RichTextDocSchema.parse(yXmlFragmentToRichText(fragment))).toEqual(list);
  });

  it("encoding mengikuti y-prosemirror: elemen per blok, satu XmlText per deretan teks, mark = atribut format", () => {
    const { fragment } = attached(SAMPLE);
    const paragraph = fragment.get(1);
    if (!(paragraph instanceof Y.XmlElement)) throw new Error("bukan elemen");
    expect(paragraph.nodeName).toBe("paragraph");
    expect(
      paragraph.toArray().map((child) => (child instanceof Y.XmlText ? "text" : (child as Y.XmlElement).nodeName)),
    ).toEqual(["text", "hardBreak", "text"]);
    const first = paragraph.get(0);
    if (!(first instanceof Y.XmlText)) throw new Error("bukan teks");
    expect(first.toDelta()).toEqual([{ insert: "Kue " }, { insert: "lembut", attributes: { bold: {}, italic: {} } }]);
    expect((fragment.get(0) as Y.XmlElement).getAttributes()).toEqual({ level: 2, align: "center" });
  });

  it("mark textStyle round-trip & buang atribut null (ED-125)", () => {
    const styled: RichTextDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "warna",
              marks: [{ type: "textStyle", attrs: { color: "#ff0000", fontWeight: 700 } }],
            },
          ],
        },
      ],
    };
    expect(RichTextDocSchema.parse(yXmlFragmentToRichText(attached(styled).fragment))).toEqual(styled);

    // y-prosemirror menulis atribut mark yang belum diisi sebagai `null` → harus dibuang, bukan disimpan.
    const ydoc = new Y.Doc();
    const fragment = new Y.XmlFragment();
    ydoc.getMap("root").set("content", fragment);
    const paragraph = new Y.XmlElement("paragraph");
    fragment.insert(0, [paragraph]);
    const text = new Y.XmlText();
    paragraph.insert(0, [text]);
    text.applyDelta([
      { insert: "x", attributes: { textStyle: { color: "#00ff00", fontWeight: null, fontSize: null } } },
    ]);
    const parsed = RichTextDocSchema.parse(yXmlFragmentToRichText(fragment));
    const block = parsed.content[0];
    const inline = block?.type === "paragraph" ? block.content?.[0] : undefined;
    expect(inline).toEqual({ type: "text", text: "x", marks: [{ type: "textStyle", attrs: { color: "#00ff00" } }] });
  });

  it("edit teks konkuren dari dua klien digabung per karakter (bukan last-writer-wins)", () => {
    const a = jsonToYDoc(heroDocument());
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const textOf = (doc: Y.Doc) => {
      const props = (doc.getMap("nodes").get("n_herottl001") as Y.Map<unknown>).get("props") as Y.Map<unknown>;
      return ((props.get("content") as Y.XmlFragment).get(0) as Y.XmlElement).get(0) as Y.XmlText;
    };
    textOf(a).insert(0, "A");
    textOf(b).insert(textOf(b).length, "B");
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    const merged = (yDocToJson(a) as ReturnType<typeof heroDocument>).nodes.n_herottl001;
    expect(yDocToJson(a)).toEqual(yDocToJson(b));
    expect(JSON.stringify(merged?.props)).toMatch(/"text":"AKue rumahan, ".*B"/);
  });

  it("node selain blok di root fragment diabaikan", () => {
    const { fragment } = attached(SAMPLE);
    fragment.insert(0, [new Y.XmlText("liar")]);
    expect(RichTextDocSchema.parse(yXmlFragmentToRichText(fragment))).toEqual(SAMPLE);
  });
});
