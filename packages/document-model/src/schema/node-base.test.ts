import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { lintDocument } from "../validate/lint";
import { jsonToYDoc, yDocToJson } from "../yjs/mapping";
import { SiteDocumentSchema } from "./document";
import type { Node, SiteDocument } from "./index";

// T1.8.4: node base (DM-008) & semantic tag (DM-009).
const SECTION = "n_hero000001";

/** Tambah node teks ber-tag `tag` di akhir section hero. */
function withText(doc: SiteDocument, id: string, tag: "h1" | "h2" | "h3" | "h4" | "p", extra: Partial<Node> = {}) {
  const section = doc.nodes[SECTION];
  if (!section || !("children" in section)) throw new Error("fixture berubah");
  section.children.push(id);
  doc.nodes[id] = {
    id,
    type: "text",
    name: `Teks / ${tag}`,
    parentId: SECTION,
    visible: true,
    locked: false,
    tag,
    style: { base: {} },
    props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Isi" }] }] } },
    ...extra,
  } as Node;
  return doc;
}

const issuesAt = (doc: unknown) =>
  (SiteDocumentSchema.safeParse(doc).error?.issues ?? []).map((issue) => issue.path.join("."));

describe("node base (DM-008)", () => {
  it("node non-container dengan children ditolak (AC)", () => {
    const doc = heroDocument();
    (doc.nodes.n_herottl001 as unknown as Record<string, unknown>).children = [];
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("htmlId: slug valid diterima; duplikat dalam satu page ditolak (AC)", () => {
    const doc = withText(heroDocument(), "n_kontak00001", "p", { htmlId: "tentang-kami" } as Partial<Node>);
    (doc.nodes[SECTION] as Node).htmlId = "tentang-kami";
    expect(issuesAt(doc)).toContain("nodes.n_kontak00001.htmlId");

    const fixed = withText(heroDocument(), "n_kontak00001", "p", { htmlId: "kontak" } as Partial<Node>);
    (fixed.nodes[SECTION] as Node).htmlId = "tentang-kami";
    expect(SiteDocumentSchema.safeParse(fixed).success).toBe(true);
  });

  it.each(["Tentang Kami", "1-angka-dulu", "garis_bawah", ""])("htmlId tidak valid %j ditolak", (htmlId) => {
    const doc = heroDocument();
    (doc.nodes[SECTION] as Node).htmlId = htmlId;
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("metadata: field dikenal strict, aiNote ≤ 200, ext bebas (JSON); a11y", () => {
    const doc = heroDocument();
    const section = doc.nodes[SECTION] as Node;
    section.metadata = {
      createdBy: "ai",
      aiNote: "Hero utama: judul + foto produk",
      fromTemplate: { templateId: "tpl_bakery01", version: 3, nodeId: "n_tplhero0001" },
      editor: { collapsed: true },
      ext: { eksperimen: { skor: 0.8, label: ["a", "b"] } },
    };
    section.a11y = { label: "Bagian pembuka", role: "region" };
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);

    section.metadata = { aiNote: "x".repeat(201) };
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(false);
    section.metadata = { rahasia: true } as never;
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("htmlId, a11y, metadata round-trip Yjs lossless", () => {
    const doc = withText(heroDocument(), "n_kontak00001", "p", {
      htmlId: "kontak",
      a11y: { hiddenFromScreenReader: true },
      metadata: { createdBy: "template", ext: { x: 1 } },
    } as Partial<Node>);
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(jsonToYDoc(SiteDocumentSchema.parse(doc))));
    expect(yDocToJson(ydoc)).toEqual(doc);
  });
});

describe("semantic tag (DM-009)", () => {
  it("tag di luar daftar allowed ditolak (AC)", () => {
    const doc = heroDocument();
    (doc.nodes.n_herottl001 as unknown as Record<string, unknown>).tag = "div";
    (doc.nodes[SECTION] as unknown as Record<string, unknown>).tag = "form";
    expect(issuesAt(doc)).toEqual(expect.arrayContaining(["nodes.n_herottl001.tag", "nodes.n_hero000001.tag"]));
  });

  it("lint (warning): >1 h1, heading melompat, gambar tanpa alt — dokumen tetap valid", () => {
    const doc = withText(withText(heroDocument(), "n_judul200001", "h1"), "n_sub0000001", "h4");
    const image = doc.nodes.n_heroimg001;
    if (image?.type === "image") image.props.image.alt = "";
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);
    expect(lintDocument(doc).map((warning) => [warning.code, warning.nodeId])).toEqual([
      ["IMAGE_MISSING_ALT", "n_heroimg001"],
      ["MULTIPLE_H1", "n_judul200001"],
      ["HEADING_SKIP", "n_sub0000001"],
    ]);
  });

  it("gambar dekoratif tanpa alt & urutan heading wajar → tanpa warning", () => {
    const doc = withText(heroDocument(), "n_sub0000001", "h2");
    const image = doc.nodes.n_heroimg001;
    if (image?.type === "image") {
      image.props.image.alt = "";
      image.props.decorative = true;
    }
    expect(lintDocument(doc)).toEqual([]);
  });
});

// T1.10.5: DM-009 — elemen interaktif bersarang = warning (renderer melepas link dalam).
describe("lint NESTED_LINK", () => {
  it("link image/teks di dalam frame berlink → warning; tanpa frame berlink → tidak", () => {
    const doc = heroDocument();
    const image = doc.nodes.n_heroimg001;
    if (image?.type === "image") image.props.link = { type: "url", href: "https://contoh.id" };
    expect(lintDocument(doc).map((warning) => warning.code)).not.toContain("NESTED_LINK");

    const hero = doc.nodes.n_hero000001;
    if (hero?.type === "frame") hero.props.link = { type: "page", pageId: "pg_about00001" };
    const title = doc.nodes.n_herottl001;
    if (title?.type === "text") {
      title.props.content = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Lihat",
                marks: [{ type: "link", attrs: { link: { type: "url", href: "https://a.id" } } }],
              },
            ],
          },
        ],
      };
    }
    const nested = lintDocument(doc)
      .filter((warning) => warning.code === "NESTED_LINK")
      .map((warning) => warning.nodeId);
    expect(nested.sort()).toEqual(["n_heroimg001", "n_herottl001"]);
  });
});

// T2.17.4: DM-009/ED-219 — nesting tag (li di luar ul/ol, >1 main per page).
describe("lint nesting (ED-219)", () => {
  const codes = (doc: SiteDocument, code: string) =>
    lintDocument(doc)
      .filter((warning) => warning.code === code)
      .map((warning) => warning.nodeId);

  it("li di luar ul/ol → LI_OUTSIDE_LIST; di dalam ul → bersih", () => {
    const doc = heroDocument();
    (doc.nodes.n_herottl001 as unknown as Record<string, unknown>).tag = "li"; // parent = section (div)
    expect(codes(doc, "LI_OUTSIDE_LIST")).toEqual(["n_herottl001"]);

    (doc.nodes.n_hero000001 as unknown as Record<string, unknown>).tag = "ul";
    expect(codes(doc, "LI_OUTSIDE_LIST")).toEqual([]);
  });

  it("frame bertag main (selain wrapper page) → MULTIPLE_MAIN", () => {
    const doc = heroDocument();
    (doc.nodes.n_hero000001 as unknown as Record<string, unknown>).tag = "main";
    expect(codes(doc, "MULTIPLE_MAIN")).toEqual(["n_hero000001"]);
  });
});
