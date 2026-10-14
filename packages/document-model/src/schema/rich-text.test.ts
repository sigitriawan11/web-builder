import { describe, expect, it } from "vitest";
import { richTextDocument } from "../../test/fixtures/basic-documents";
import { plainText } from "../query/rich-text";
import { LinkValueSchema } from "./link";
import { RichTextDocSchema } from "./rich-text";

// T1.8.7: rich text (DM-013) & LinkValue (DM-056, bagian schema).
const textNode = () => {
  const node = richTextDocument().nodes.n_richtext001;
  if (node?.type !== "text") throw new Error("fixture berubah");
  return node;
};
const docWith = (content: unknown[]) => ({ type: "doc", content });
const para = (inlines: unknown[]) => ({ type: "paragraph", content: inlines });

describe("RichTextDocSchema (DM-013)", () => {
  it("fixture: bold, link, textStyle token, hardBreak, list bersarang valid", () => {
    expect(RichTextDocSchema.safeParse(textNode().props.content).success).toBe(true);
  });

  it.each([
    ["blok di luar schema (image di dalam teks)", docWith([{ type: "image", attrs: { src: "x" } }])],
    ["HTML mentah", docWith([{ type: "html", content: "<b>x</b>" }])],
    ["hardBreak sebagai blok (inline saja)", docWith([{ type: "hardBreak" }])],
    ["mark tak dikenal", docWith([para([{ type: "text", text: "x", marks: [{ type: "code" }] }])])],
    ["mark ganda", docWith([para([{ type: "text", text: "x", marks: [{ type: "bold" }, { type: "bold" }] }])])],
    [
      "textStyle tanpa atribut",
      docWith([para([{ type: "text", text: "x", marks: [{ type: "textStyle", attrs: {} }] }])]),
    ],
    [
      "textStyle atribut ke-5",
      docWith([para([{ type: "text", text: "x", marks: [{ type: "textStyle", attrs: { lineHeight: 2 } }] }])]),
    ],
    [
      "link javascript:",
      docWith([
        para([
          {
            type: "text",
            text: "x",
            marks: [{ type: "link", attrs: { link: { type: "url", href: "javascript:alert(1)" } } }],
          },
        ]),
      ]),
    ],
    ["list kosong", docWith([{ type: "bulletList", content: [] }])],
    ["listItem kosong", docWith([{ type: "orderedList", content: [{ type: "listItem", content: [] }] }])],
    ["teks kosong", docWith([para([{ type: "text", text: "" }])])],
  ])("menolak %s", (_label, doc) => {
    expect(RichTextDocSchema.safeParse(doc).success).toBe(false);
  });
});

describe("LinkValue (DM-056)", () => {
  it.each([
    { type: "url", href: "https://tokokue.id/menu", newTab: true },
    { type: "page", pageId: "pg_about00001", anchorNodeId: "n_kontak00001" },
    { type: "anchor", nodeId: "n_kontak00001" },
    { type: "email", to: "halo@tokokue.id", subject: "Pesan kue" },
    { type: "phone", phone: "6281234567890" },
    { type: "whatsapp", phone: "6281234567890", message: "Halo" },
    { type: "asset", assetId: "ast_menu000001" },
  ])("valid: $type", (link) => {
    expect(LinkValueSchema.safeParse(link).success).toBe(true);
  });

  it.each([
    { type: "url", href: "javascript:alert(1)" },
    { type: "url", href: "data:text/html,<script>" },
    { type: "url", href: "ftp://tokokue.id" },
    { type: "phone", phone: "081234567890" },
    { type: "phone", phone: "+6281234567890" },
    { type: "whatsapp", phone: "62 812 3456" },
    { type: "email", to: "bukan-email" },
    { type: "page", pageId: "n_bukanpage01" },
  ])("ditolak: %o", (link) => {
    expect(LinkValueSchema.safeParse(link).success).toBe(false);
  });
});

describe("plainText (AC DM-013)", () => {
  it("blok per baris, hardBreak = baris baru, list ditelusuri berurutan, mark diabaikan", () => {
    expect(plainText(textNode().props.content)).toBe(
      "Kue rumahan, fresh setiap hari\npesan via WhatsApp\nBolu\nKue kering\nNastar",
    );
  });

  it("dokumen kosong → string kosong", () => {
    expect(plainText({ type: "doc", content: [] })).toBe("");
  });
});
