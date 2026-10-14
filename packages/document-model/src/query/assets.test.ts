import { describe, expect, it } from "vitest";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { SiteDocumentSchema } from "../schema";
import { collectAssetRefs, gcAssets } from "./assets";

// T1.8.8: AC DM-057 — gcAssets membuang entri registry yang tidak dirujuk.
describe("collectAssetRefs", () => {
  it("menemukan rujukan di props node, settings, dan theme beserta path", () => {
    const doc = heroDocument();
    doc.settings.favicon = { assetId: "ast_favicon001" };
    const refs = collectAssetRefs(doc);
    expect(refs).toEqual(
      expect.arrayContaining([
        { assetId: "ast_cake000001", path: ["nodes", "n_heroimg001", "props", "image", "assetId"] },
        { assetId: "ast_favicon001", path: ["settings", "favicon", "assetId"] },
      ]),
    );
  });
});

describe("gcAssets", () => {
  it("membuang asset yang tidak dirujuk, mempertahankan yang dirujuk, tanpa mengubah input", () => {
    const doc = heroDocument();
    doc.assets.ast_orphan0001 = { kind: "image", mime: "image/png" };
    doc.assets.ast_og00000001 = { kind: "image", mime: "image/jpeg" };
    doc.settings.seo.ogImage = { assetId: "ast_og00000001" };

    const cleaned = gcAssets(doc);
    expect(Object.keys(cleaned.assets).sort()).toEqual(["ast_cake000001", "ast_og00000001"]);
    expect(doc.assets.ast_orphan0001).toBeDefined();
    expect(SiteDocumentSchema.safeParse(cleaned).success).toBe(true);
    expect(gcAssets(cleaned)).toEqual(cleaned);
  });

  it("dokumen tanpa rujukan → registry kosong", () => {
    const doc = heroDocument();
    const img = doc.nodes.n_heroimg001;
    const hero = doc.nodes.n_hero000001;
    if (hero?.type !== "frame" || !img) throw new Error("fixture berubah");
    hero.children = hero.children.filter((id) => id !== img.id);
    delete doc.nodes.n_heroimg001;
    expect(gcAssets(doc).assets).toEqual({});
  });
});
