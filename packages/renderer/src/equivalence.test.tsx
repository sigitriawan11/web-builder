import type { SiteDocument } from "@platform/document-model";
import * as fixtures from "@platform/document-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPageStyles } from "./css/stylesheet";
import { render } from "./render";

// T1.10.8 / ED-017 AC / ARCHITECTURE §14: HTML mode editor − atribut editor == HTML publish (satu renderer, P2).
const assetUrl = (assetId: string) => `https://cdn.test/${assetId}`;

const documents: [string, SiteDocument][] = [
  ["minimal", fixtures.minimalDocument()],
  ["hero", fixtures.heroDocument()],
  ["nested", fixtures.nestedDocument()],
  ["freeform", fixtures.freeformDocument()],
  ["autolayout", fixtures.autolayoutDocument()],
  ["wrapGrid", fixtures.wrapGridDocument()],
  ["richText", fixtures.richTextDocument()],
  ["styled", fixtures.styledDocument()],
  ["fullTopLevel", fixtures.fullTopLevelDocument()],
  ["landing200", fixtures.landing200()],
  ["responsiveSections", fixtures.responsiveSectionsDocument().document],
  ...Array.from({ length: 10 }, (_, seed): [string, SiteDocument] => [
    `landing-seed${seed + 1}`,
    fixtures.generateLandingDocument({ nodeCount: 150, seed: seed + 1 }),
  ]),
];
const pages = documents.flatMap(([name, doc]) =>
  doc.pageOrder.map((pageId): [string, SiteDocument, string] => [`${name}/${pageId}`, doc, pageId]),
);

function renderBoth(doc: SiteDocument, pageId: string) {
  const publishStyles = buildPageStyles(doc, { pageId, assetUrl, target: "publish" });
  const editorStyles = buildPageStyles(doc, { pageId, assetUrl, target: "editor" });
  const publish = renderToStaticMarkup(
    render(doc, {
      pageId,
      breakpoint: "base",
      mode: "publish",
      assetUrl,
      className: (node) => publishStyles.classOf(node.id),
    }),
  );
  const editor = renderToStaticMarkup(
    render(doc, {
      pageId,
      breakpoint: "base",
      mode: "editor",
      assetUrl,
      className: (node) => editorStyles.classOf(node.id),
      nodeAttributes: (node) => ({ "data-node-id": node.id }),
    }),
  );
  return { publish, editor };
}

const VOID = new Set(["img", "br", "link", "meta", "input", "hr"]);

/** Buang elemen ber-`hidden` (node `visible:false` hanya ada di editor) beserta isinya; HTML React selalu well-formed. */
function withoutHidden(html: string): string {
  let out = "";
  let skipDepth = 0;
  for (const token of html.split(/(<[^>]+>)/)) {
    const open = /^<([a-z0-9]+)[\s>/]/i.exec(token);
    const isVoid = open !== null && (VOID.has((open[1] ?? "").toLowerCase()) || token.endsWith("/>"));
    if (skipDepth > 0) {
      if (open && !isVoid) skipDepth++;
      if (/^<\/[a-z0-9]+>$/i.test(token)) skipDepth--;
      continue;
    }
    if (open && / hidden=""/.test(token)) {
      if (!isVoid) skipDepth = 1;
      continue;
    }
    out += token;
  }
  return out;
}

/**
 * Atribut khusus editor: `data-node-id` dihapus, `data-href` (link tanpa navigasi) = `href` publish, node
 * `visible:false` (ada di editor sebagai `hidden`, tidak dipublish) dibuang.
 */
const withoutEditorAttributes = (html: string) =>
  withoutHidden(html.replace(/ data-node-id="[^"]*"/g, "").replaceAll(" data-href=", " href="));

describe("kesetaraan editor vs publish", () => {
  it("minimal 20 page fixture diuji (AC ED-017)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(20);
  });

  it.each(pages)("%s: identik selain atribut editor", (_, doc, pageId) => {
    const { publish, editor } = renderBoth(doc, pageId);
    expect(withoutEditorAttributes(editor)).toBe(publish);
    // Setiap elemen node di editor membawa data-node-id; publish tidak sama sekali (PUB-049).
    expect(publish).not.toContain("data-node-id");
    expect(editor.match(/ data-node-id="/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it("satu-satunya perbedaan lain yang disengaja: node visible:false ada di editor (hidden), tidak di publish", () => {
    const doc = fixtures.heroDocument();
    const image = doc.nodes.n_heroimg001;
    if (image) image.visible = false;
    const { publish, editor } = renderBoth(doc, "pg_home000001");
    const normalized = withoutEditorAttributes(editor);
    expect(editor).toMatch(/<img [^>]*hidden=""/);
    expect(publish).not.toContain("<img");
    expect(normalized).toBe(publish);
  });

  it("link di editor: atribut sama dengan publish tetapi tanpa href (tidak bernavigasi)", () => {
    const doc = fixtures.richTextDocument();
    const { publish, editor } = renderBoth(doc, "pg_home000001");
    expect(publish).toContain(
      '<a href="https://wa.me/6281234567890?text=Halo" target="_blank" rel="noopener noreferrer">',
    );
    expect(editor).toContain(
      '<a data-href="https://wa.me/6281234567890?text=Halo" target="_blank" rel="noopener noreferrer">',
    );
    expect(editor).not.toMatch(/<a [^>]*\shref=/);
  });
});
