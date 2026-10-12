import { heroDocument, landing2000, nestedDocument } from "@platform/document-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RenderScope } from "./RenderRoot";
import { renderNode } from "./render-node";

const render = (doc: ReturnType<typeof heroDocument>) =>
  renderToStaticMarkup(<RenderScope>{renderNode(doc, doc.pageOrder[0] ?? "")}</RenderScope>);

function nodeIdsIn(html: string): string[] {
  return [...html.matchAll(/data-node-id="([^"]+)"/g)].map((match) => match[1] ?? "");
}

describe("renderNode (T0.4.1)", () => {
  it("snapshot DOM fixture hero", () => {
    expect(render(heroDocument())).toMatchSnapshot();
  });

  it("snapshot DOM fixture nested (kasus tepi)", () => {
    expect(render(nestedDocument())).toMatchSnapshot();
  });

  it("setiap node page aktif dirender tepat sekali dengan data-node-id (ED-017)", () => {
    const doc = heroDocument();
    const ids = nodeIdsIn(render(doc));

    expect(ids).toEqual(["pg_home000001", "n_hero000001", "n_herottl001", "n_heroimg001"]);
  });

  it("memakai tag semantik dokumen dan default per tipe (DM-009)", () => {
    const html = render(heroDocument());

    expect(html).toContain('<main data-node-id="pg_home000001"');
    expect(html).toContain('<section data-node-id="n_hero000001"');
    expect(html).toContain('<h1 data-node-id="n_herottl001"');
    expect(html).toContain('<img data-node-id="n_heroimg001"');
    expect(html).toContain('alt="Kue cokelat di meja kayu"');
    expect(html).toContain("object-position:50% 40%");
  });

  it("merender mark, multi-blok, node tersembunyi, dan gambar dekoratif", () => {
    const html = render(nestedDocument());

    expect(html).toContain("<em><strong>Satu</strong></em><br/><s><u>Dua</u></s>");
    expect(html).toMatch(/<h2 data-node-id="n_lvl4text001" style="[^"]*display:none/);
    expect(html).toMatch(/<img data-node-id="n_lvl4img0001"[^>]*alt=""/);
  });

  it("mengembalikan null untuk node yang tidak ada", () => {
    expect(renderNode(heroDocument(), "n_ghost00001")).toBeNull();
  });

  it("merender fixture 2.000 node lengkap", () => {
    const doc = landing2000();

    expect(new Set(nodeIdsIn(render(doc))).size).toBe(2000);
  });
});
