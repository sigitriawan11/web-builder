import { describe, expect, it } from "vitest";
import type * as Y from "yjs";
import { setupDoc } from "../../test/command-harness";
import { heroDocument, richTextDocument } from "../../test/fixtures/basic-documents";
import { plainText } from "../query/rich-text";
import { validateDocument } from "../validate/validate-document";
import { YDOC_KEYS } from "../yjs/mapping";
import { runCommand } from "./command";
import { replaceText, setImage, setLink, setNodeProps, setTextContent } from "./content";
import { createPage, deletePage, reorderPages, updatePage } from "./pages";

// T1.9.7: command konten & page (DM-074).
const fragmentOf = (doc: Y.Doc, id: string) =>
  (doc.getMap<Y.Map<unknown>>(YDOC_KEYS.nodes).get(id)?.get("props") as Y.Map<unknown> | undefined)?.get("content") as
    | Y.XmlFragment
    | undefined;

describe("setTextContent", () => {
  it("string → satu paragraf (baris baru = hardBreak); fragment diganti DI TEMPAT; bisa di-undo", () => {
    const { ctx, doc, read, undoManager } = setupDoc(heroDocument());
    const before = fragmentOf(doc, "n_herottl001");
    expect(runCommand(ctx, setTextContent, { id: "n_herottl001", content: "Kue enak\nHarga hemat" }).ok).toBe(true);
    const title = read().nodes.n_herottl001;
    expect(title?.type === "text" ? title.props.content : null).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Kue enak" }, { type: "hardBreak" }, { type: "text", text: "Harga hemat" }],
        },
      ],
    });
    expect(fragmentOf(doc, "n_herottl001")).toBe(before);
    undoManager.undo();
    expect(read()).toEqual(heroDocument());
  });

  it("node bukan teks & teks terlalu panjang ditolak", () => {
    const { ctx } = setupDoc(heroDocument());
    expect(runCommand(ctx, setTextContent, { id: "n_hero000001", content: "x" })).toMatchObject({
      error: { code: "INVALID_TARGET" },
    });
    expect(runCommand(ctx, setTextContent, { id: "n_herottl001", content: "a".repeat(20_001) })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
  });
});

describe("replaceText", () => {
  it("mempertahankan mark teks yang diganti; menghitung semua kemunculan", () => {
    const { ctx, read } = setupDoc(richTextDocument());
    const textOf = () => {
      const node = read().nodes.n_richtext001;
      return node?.type === "text" ? plainText(node.props.content) : "";
    };
    const original = textOf();
    const result = runCommand(ctx, replaceText, { id: "n_richtext001", find: "setiap", replace: "tiap" });
    // Seluruh teks lain tidak bergeser.
    expect(textOf()).toBe(original.replace("setiap", "tiap"));
    expect(result).toMatchObject({ ok: true, value: { replaced: 1 } });
    const node = read().nodes.n_richtext001;
    const [paragraph] = node?.type === "text" ? node.props.content.content : [];
    expect(paragraph && "content" in paragraph ? paragraph.content?.[1] : null).toEqual({
      type: "text",
      text: "fresh tiap hari",
      marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: { $token: "color.primary" } } }],
    });
    expect(runCommand(ctx, replaceText, { id: "n_richtext001", find: "e", replace: "E" })).toMatchObject({
      ok: true,
      value: { replaced: expect.any(Number) },
    });
  });

  it("mengganti seluruh run bermark (batas run) tetap mempertahankan mark-nya", () => {
    const { ctx, read } = setupDoc(richTextDocument());
    runCommand(ctx, replaceText, { id: "n_richtext001", find: "fresh setiap hari", replace: "selalu baru" });
    const node = read().nodes.n_richtext001;
    const [paragraph] = node?.type === "text" ? node.props.content.content : [];
    expect(paragraph && "content" in paragraph ? paragraph.content?.slice(0, 2) : null).toEqual([
      { type: "text", text: "Kue rumahan, " },
      {
        type: "text",
        text: "selalu baru",
        marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: { $token: "color.primary" } } }],
      },
    ]);
  });

  it("tidak ditemukan → replaced 0 tanpa update", () => {
    const { ctx, doc } = setupDoc(heroDocument());
    let updates = 0;
    doc.on("update", () => updates++);
    expect(runCommand(ctx, replaceText, { id: "n_herottl001", find: "zzz", replace: "x" })).toMatchObject({
      value: { replaced: 0 },
    });
    expect(updates).toBe(0);
  });
});

describe("setImage & setLink & setNodeProps", () => {
  it("setImage: asset wajib terdaftar & berjenis gambar", () => {
    const { ctx, doc, read } = setupDoc(heroDocument());
    expect(runCommand(ctx, setImage, { id: "n_heroimg001", image: { assetId: "ast_belumada01" } })).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
    doc.getMap(YDOC_KEYS.assets).set("ast_video00001", { kind: "video", mime: "video/mp4" });
    expect(runCommand(ctx, setImage, { id: "n_heroimg001", image: { assetId: "ast_video00001" } })).toMatchObject({
      error: { code: "INVALID_TARGET" },
    });
    expect(
      runCommand(ctx, setImage, {
        id: "n_heroimg001",
        image: { assetId: "ast_cake000001", alt: "Bolu" },
        fit: "contain",
      }).ok,
    ).toBe(true);
    const image = read().nodes.n_heroimg001;
    expect(image?.type === "image" ? image.props : null).toMatchObject({
      image: { assetId: "ast_cake000001", alt: "Bolu" },
      fit: "contain",
    });
  });

  it("setLink: nomor dinormalisasi, rujukan wajib ada, javascript: ditolak, null menghapus", () => {
    const { ctx, read } = setupDoc(heroDocument());
    expect(
      runCommand(ctx, setLink, { id: "n_hero000001", link: { type: "whatsapp", phone: "0812-3456-7890" } }).ok,
    ).toBe(true);
    const hero = read().nodes.n_hero000001;
    expect(hero?.type === "frame" ? hero.props.link : null).toEqual({ type: "whatsapp", phone: "6281234567890" });

    expect(
      runCommand(ctx, setLink, { id: "n_hero000001", link: { type: "url", href: "javascript:alert(1)" } }),
    ).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(
      runCommand(ctx, setLink, { id: "n_hero000001", link: { type: "page", pageId: "pg_hilang00001" } }),
    ).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
    expect(
      runCommand(ctx, setLink, {
        id: "n_hero000001",
        link: { type: "page", pageId: "pg_about00001", anchorNodeId: "n_herottl001" },
      }),
    ).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(runCommand(ctx, setLink, { id: "n_heroimg001", link: { type: "anchor", nodeId: "n_herottl001" } }).ok).toBe(
      true,
    );
    expect(runCommand(ctx, setLink, { id: "n_herottl001", link: null })).toMatchObject({
      error: { code: "INVALID_TARGET" },
    });
    runCommand(ctx, setLink, { id: "n_hero000001", link: null });
    const cleared = read().nodes.n_hero000001;
    expect(cleared?.type === "frame" ? cleared.props.link : "x").toBeUndefined();
  });

  it("setNodeProps: per key, divalidasi per tipe; content teks & props page ditolak", () => {
    const { ctx, read } = setupDoc(heroDocument());
    expect(runCommand(ctx, setNodeProps, { id: "n_hero000001", patch: { role: "card", clipContent: true } }).ok).toBe(
      true,
    );
    expect(read().nodes.n_hero000001?.props).toMatchObject({ role: "card", clipContent: true });
    runCommand(ctx, setNodeProps, { id: "n_hero000001", patch: { clipContent: null } });
    expect(read().nodes.n_hero000001?.props).not.toHaveProperty("clipContent");
    expect(runCommand(ctx, setNodeProps, { id: "n_hero000001", patch: { role: "hero" } })).toMatchObject({
      error: { code: "INVALID_RESULT" },
    });
    expect(runCommand(ctx, setNodeProps, { id: "n_herottl001", patch: { content: {} } })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(runCommand(ctx, setNodeProps, { id: "pg_home000001", patch: { title: "x" } })).toMatchObject({
      error: { code: "INVALID_TARGET" },
    });
  });
});

describe("page", () => {
  it("createPage: path unik, '/' ditolak, posisi sesuai index; dokumen tetap valid", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const result = runCommand(ctx, createPage, { title: "Menu", path: "/menu", index: 1 });
    if (!result.ok) throw new Error(result.error.message.id);
    const doc = read();
    expect(doc.pageOrder).toEqual(["pg_home000001", result.value, "pg_about00001"]);
    expect(doc.nodes[result.value]).toMatchObject({
      type: "page",
      props: { path: "/menu", title: "Menu", isHome: false },
    });
    expect(runCommand(ctx, createPage, { title: "Lagi", path: "/menu" })).toMatchObject({
      error: { code: "INVALID_RESULT" },
    });
    expect(runCommand(ctx, createPage, { title: "Home 2", path: "/" })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(validateDocument(read(), { mode: "edit" }).ok).toBe(true);
  });

  it("updatePage: judul/SEO; path bentrok ditolak; isHome menukar path dengan home lama", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const aboutPath =
      read().nodes.pg_about00001?.type === "page"
        ? (read().nodes.pg_about00001 as { props: { path: string } }).props.path
        : "";
    expect(
      runCommand(ctx, updatePage, { id: "pg_about00001", patch: { title: "Tentang Kami", seo: { noIndex: true } } }).ok,
    ).toBe(true);
    expect(runCommand(ctx, updatePage, { id: "pg_about00001", patch: { path: "/" } })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
    expect(runCommand(ctx, updatePage, { id: "pg_home000001", patch: { isHome: false } })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });

    expect(runCommand(ctx, updatePage, { id: "pg_about00001", patch: { isHome: true } }).ok).toBe(true);
    const doc = read();
    expect(doc.nodes.pg_about00001).toMatchObject({ props: { isHome: true, path: "/", title: "Tentang Kami" } });
    expect(doc.nodes.pg_home000001).toMatchObject({ props: { isHome: false, path: aboutPath } });
    expect(validateDocument(doc, { mode: "edit" }).ok).toBe(true);
  });

  it("reorderPages wajib permutasi lengkap", () => {
    const { ctx, read } = setupDoc(heroDocument());
    expect(runCommand(ctx, reorderPages, { order: ["pg_about00001", "pg_home000001"] }).ok).toBe(true);
    expect(read().pageOrder).toEqual(["pg_about00001", "pg_home000001"]);
    for (const order of [["pg_about00001"], ["pg_about00001", "pg_about00001"], ["pg_about00001", "pg_lain000001"]]) {
      expect(runCommand(ctx, reorderPages, { order }), JSON.stringify(order)).toMatchObject({
        error: { code: "INVALID_INPUT" },
      });
    }
  });

  it("deletePage: home ditolak (AC); page lain terhapus beserta isinya, link ke sana jadi BROKEN_LINK", () => {
    const { ctx, read } = setupDoc(heroDocument());
    expect(runCommand(ctx, deletePage, { id: "pg_home000001" })).toMatchObject({
      ok: false,
      error: { code: "INVALID_TARGET" },
    });
    runCommand(ctx, setLink, { id: "n_hero000001", link: { type: "page", pageId: "pg_about00001" } });
    const aboutNodes = Object.values(read().nodes).filter(
      (node) => node.id === "pg_about00001" || node.parentId === "pg_about00001",
    );

    const result = runCommand(ctx, deletePage, { id: "pg_about00001" });
    expect(result).toMatchObject({
      ok: true,
      value: { removedIds: expect.arrayContaining(aboutNodes.map((node) => node.id)) },
    });
    const doc = read();
    expect(doc.pageOrder).toEqual(["pg_home000001"]);
    expect(doc.nodes.pg_about00001).toBeUndefined();
    const validation = validateDocument(doc, { mode: "edit" });
    expect(validation.ok).toBe(true);
    expect(validation.warnings.map((issue) => issue.code)).toContain("BROKEN_LINK");
  });
});
