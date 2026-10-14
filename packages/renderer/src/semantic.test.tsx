import type { Node, SiteDocument } from "@platform/document-model";
import { heroDocument } from "@platform/document-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RenderContext } from "./context";
import { buildPageStyles } from "./css/stylesheet";
import { render } from "./render";

// T1.10.5: tag semantik (DM-009) & visibilitas per breakpoint (DM-039).
const HOME = "pg_home000001";
const assetUrl = (assetId: string) => `https://cdn.test/${assetId}`;
const ctx = (mode: RenderContext["mode"] = "publish"): RenderContext => ({
  pageId: HOME,
  breakpoint: "base",
  mode,
  assetUrl,
});

const content = (value: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: value }] }],
});
const base = { visible: true, locked: false, style: { base: {} } };
const frame = (id: string, parentId: string, children: string[], tag?: string): Node =>
  ({ id, type: "frame", name: id, parentId, children, ...base, ...(tag ? { tag } : {}), props: {} }) as Node;
const text = (id: string, parentId: string, value: string, tag?: string): Node =>
  ({
    id,
    type: "text",
    name: id,
    parentId,
    ...base,
    ...(tag ? { tag } : {}),
    props: { content: content(value) },
  }) as Node;

/** Landing semantik: header > nav > ul > li, section > h1 + p + blockquote, footer > span; gambar. */
function semanticDocument(): SiteDocument {
  const doc = heroDocument();
  const page = doc.nodes[HOME];
  if (page?.type !== "page") throw new Error("fixture berubah");
  for (const id of Object.keys(doc.nodes)) if (id !== HOME && id !== "n_heroimg001") delete doc.nodes[id];
  doc.pageOrder = [HOME];
  page.children = ["n_header0001", "n_section001", "n_footer0001"];
  const nodes: Node[] = [
    frame("n_header0001", HOME, ["n_nav0000001"], "header"),
    frame("n_nav0000001", "n_header0001", ["n_list000001"], "nav"),
    frame("n_list000001", "n_nav0000001", ["n_item000001"], "ul"),
    frame("n_item000001", "n_list000001", ["n_itemtext01"], "li"),
    text("n_itemtext01", "n_item000001", "Menu", "span"),
    frame("n_section001", HOME, ["n_title00001", "n_body000001", "n_quote00001", "n_heroimg001"], "section"),
    text("n_title00001", "n_section001", "Kue Budi", "h1"),
    text("n_body000001", "n_section001", "Kue rumahan"),
    text("n_quote00001", "n_section001", "Enak sekali!", "blockquote"),
    frame("n_footer0001", HOME, ["n_copy000001"], "footer"),
    text("n_copy000001", "n_footer0001", "© 2026", "span"),
  ];
  for (const node of nodes) doc.nodes[node.id] = node;
  const image = doc.nodes.n_heroimg001;
  if (image) image.parentId = "n_section001";
  return doc;
}

describe("tag semantik (DM-009)", () => {
  it("snapshot HTML: tag dari node, default per tipe", async () => {
    const output = renderToStaticMarkup(render(semanticDocument(), ctx()));
    expect(output).toMatch(
      /^<main><header><nav><ul><li><span>Menu<\/span><\/li><\/ul><\/nav><\/header><section><h1>Kue Budi<\/h1><p>Kue rumahan<\/p><blockquote>Enak sekali!<\/blockquote><img /,
    );
    expect(output).toMatch(/<footer><span>© 2026<\/span><\/footer><\/main>$/);
    await expect(output).toMatchFileSnapshot("../test/__snapshots__/semantic.publish.html");
  });

  it("output publish tanpa data-node-id/atribut editor; editor menambahkannya lewat hook (PUB-049)", () => {
    const publish = renderToStaticMarkup(render(semanticDocument(), ctx()));
    expect(publish).not.toMatch(/data-node-id|data-reactroot|react/i);
    const editor = renderToStaticMarkup(
      render(semanticDocument(), { ...ctx("editor"), nodeAttributes: (node) => ({ "data-node-id": node.id }) }),
    );
    expect(editor).toContain('<section data-node-id="n_section001">');
  });
});

describe("visibilitas per breakpoint (DM-039)", () => {
  it("display:none per breakpoint tetap di HTML dan disembunyikan media query; visible:false tidak dipublish", () => {
    const doc = semanticDocument();
    const quote = doc.nodes.n_quote00001;
    const footer = doc.nodes.n_footer0001;
    if (!quote || !footer) throw new Error("fixture berubah");
    quote.style.mobile = { display: "none" };
    footer.visible = false;

    const styles = buildPageStyles(doc, { pageId: HOME, assetUrl });
    const output = renderToStaticMarkup(render(doc, { ...ctx(), className: (node) => styles.classOf(node.id) }));
    const quoteClass = styles.classOf("n_quote00001") as string;
    expect(output).toContain(`<blockquote class="${quoteClass}">Enak sekali!</blockquote>`);
    expect(styles.css).toMatch(new RegExp(`@media \\(max-width:479px\\)\\{[^@]*\\.${quoteClass}\\{display:none`));
    expect(output).not.toContain("<footer");
    expect(renderToStaticMarkup(render(doc, ctx("editor")))).toContain("<footer hidden=");
  });
});

describe("tanpa elemen interaktif bersarang (DM-009)", () => {
  it("link image, frame, dan mark di dalam frame berlink dirender tanpa <a>", () => {
    const doc = semanticDocument();
    const section = doc.nodes.n_section001;
    const image = doc.nodes.n_heroimg001;
    const body = doc.nodes.n_body000001;
    const nav = doc.nodes.n_item000001;
    if (section?.type !== "frame" || image?.type !== "image" || body?.type !== "text" || nav?.type !== "frame") {
      throw new Error("fixture berubah");
    }
    section.props.link = { type: "page", pageId: HOME };
    image.props.link = { type: "url", href: "https://contoh.id" };
    body.props.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Pesan",
              marks: [{ type: "link", attrs: { link: { type: "phone", phone: "6281234567890" } } }],
            },
          ],
        },
      ],
    };
    nav.props.link = { type: "anchor", nodeId: "n_title00001" };

    const output = renderToStaticMarkup(render(doc, ctx()));
    const sectionHtml = output.slice(output.indexOf('<a href="/"'), output.indexOf("</a><footer"));
    expect(sectionHtml.match(/<a /g)).toHaveLength(1);
    expect(sectionHtml).toContain("<p><span>Pesan</span></p>");
    expect(sectionHtml).toMatch(/<img [^>]*src="https:\/\/cdn\.test\/ast_cake000001"/);
    // Link di luar frame berlink tetap <a>.
    expect(output).toContain('<a href="#n_title00001"><span>Menu</span></a>');
  });
});
