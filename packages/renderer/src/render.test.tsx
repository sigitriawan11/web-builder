import type { SiteDocument } from "@platform/document-model";
import { heroDocument, richTextDocument, styledDocument } from "@platform/document-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RenderContext } from "./context";
import { linkHref } from "./links";
import { render } from "./render";

// T1.10.1: primitives + render(document, ctx) murni (DM-001, ED-017).
const ctx = (overrides: Partial<RenderContext> = {}): RenderContext => ({
  pageId: "pg_home000001",
  breakpoint: "base",
  mode: "publish",
  assetUrl: (assetId) => `https://cdn.test/${assetId}`,
  ...overrides,
});
const html = (doc: SiteDocument, overrides: Partial<RenderContext> = {}) =>
  renderToStaticMarkup(render(doc, ctx(overrides)));

describe("render fixture", () => {
  it("hero: struktur & tag semantik, gambar dengan ukuran intrinsik", async () => {
    const output = html(heroDocument());
    expect(output).toMatch(/^<main>/);
    expect(output).toContain("<section>");
    expect(output).toMatch(/<h1[ >]/);
    expect(output).toContain('src="https://cdn.test/ast_cake000001"');
    expect(output).toContain('width="1600" height="1067"');
    await expect(output).toMatchFileSnapshot("../test/__snapshots__/hero.publish.html");
  });

  it("deterministik: dua render identik", () => {
    expect(html(styledDocument())).toBe(html(styledDocument()));
  });

  it("pageId tidak dikenal → null", () => {
    expect(render(heroDocument(), ctx({ pageId: "pg_tidakada001" }))).toBeNull();
    expect(render(heroDocument(), ctx({ pageId: "n_hero000001" }))).toBeNull();
  });

  it("metadata editor/AI tidak pernah muncul di output (DM-008)", () => {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    if (hero) hero.metadata = { aiNote: "RAHASIA-CATATAN", ext: { secret: "RAHASIA-EXT" } };
    expect(html(doc)).not.toMatch(/RAHASIA/);
  });
});

describe("visibilitas & atribut", () => {
  it("visible:false dihilangkan di publish, `hidden` di editor", () => {
    const doc = heroDocument();
    const image = doc.nodes.n_heroimg001;
    if (image) image.visible = false;
    expect(html(doc)).not.toContain("<img");
    expect(html(doc, { mode: "editor" })).toMatch(/<img[^>]* hidden=""/);
  });

  it("htmlId → id, a11y → aria-*, hook className & nodeAttributes", () => {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    if (hero) {
      hero.htmlId = "promo";
      hero.a11y = { label: "Promo utama", role: "region" };
    }
    const output = html(doc, {
      className: (node) => `c-${node.type}`,
      nodeAttributes: (node) => ({ "data-node-id": node.id }),
    });
    expect(output).toContain(
      '<section id="promo" class="c-frame" aria-label="Promo utama" role="region" data-node-id="n_hero000001">',
    );
  });
});

describe("link (DM-056)", () => {
  const doc = heroDocument();
  it.each([
    [{ type: "url", href: "https://contoh.id" }, "https://contoh.id"],
    [{ type: "url", href: "javascript:alert(1)" }, undefined],
    [{ type: "page", pageId: "pg_about00001" }, "/tentang"],
    [{ type: "page", pageId: "pg_hilang00001" }, undefined],
    [{ type: "anchor", nodeId: "n_herottl001" }, "#n_herottl001"],
    [{ type: "email", to: "budi@toko.id", subject: "Pesan kue" }, "mailto:budi@toko.id?subject=Pesan%20kue"],
    [{ type: "phone", phone: "6281234567890" }, "tel:+6281234567890"],
    [{ type: "whatsapp", phone: "6281234567890", message: "Halo kak" }, "https://wa.me/6281234567890?text=Halo%20kak"],
    [{ type: "asset", assetId: "ast_menu000001" }, "https://cdn.test/ast_menu000001"],
  ] as const)("%j → %s", (link, href) => {
    expect(linkHref(link, doc, ctx())).toBe(href);
  });

  it("frame berlink dirender <a>; anchor target mendapat id; WA membuka tab baru; editor tanpa href", () => {
    const withLink = heroDocument();
    const hero = withLink.nodes.n_hero000001;
    if (hero?.type === "frame") hero.props.link = { type: "anchor", nodeId: "n_heroimg001" };
    const image = withLink.nodes.n_heroimg001;
    if (image?.type === "image") image.props.link = { type: "whatsapp", phone: "6281234567890" };

    const output = html(withLink);
    expect(output).toMatch(/^<main><a href="#n_heroimg001">/);
    expect(output).toContain(
      '<a id="n_heroimg001" href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer"><img',
    );
    const editor = html(withLink, { mode: "editor" });
    expect(editor).not.toMatch(/\shref=/);
    expect(editor).toContain('data-href="#n_heroimg001"');
  });
});

describe("rich text", () => {
  it("mark bold/link/textStyle token, list bersarang, hardBreak; teks di-escape", () => {
    const doc = richTextDocument();
    const output = html(doc);
    expect(output).toContain("<strong>");
    expect(output).toContain(
      '<a href="https://wa.me/6281234567890?text=Halo" target="_blank" rel="noopener noreferrer">pesan via WhatsApp</a>',
    );
    expect(output).toContain("color:var(--t-color-primary)");
    expect(output).toMatch(/<ul><li>.*Bolu.*<\/li><li>.*Kue kering.*<ol><li>.*Nastar/);
    expect(output).toContain("<br/>");

    const text = doc.nodes.n_richtext001;
    if (text?.type === "text") {
      text.props.content = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>" }] }],
      };
    }
    expect(html(doc)).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html(doc)).not.toContain("<script>");
  });
});
