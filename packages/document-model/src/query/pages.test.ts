import { describe, expect, it } from "vitest";
import { createNode, createPage, runCommand, updatePage } from "../commands";
import { createBlankSiteDocument } from "../defaults/blank-site";
import { SiteDocumentSchema } from "../schema";
import { jsonToYDoc, userOrigin, yDocToJson } from "../yjs";
import { summarizePages } from "./pages";

function siteWithPages() {
  const doc = jsonToYDoc(createBlankSiteDocument({ title: "Toko" }));
  const ctx = { doc, origin: userOrigin("test") };
  const home = doc.getArray<string>("pageOrder").get(0);
  const about = runCommand(ctx, createPage, { title: "Tentang", path: "/tentang" });
  if (!about.ok) throw new Error(about.error.code);
  const section = runCommand(ctx, createNode, { parentId: home, type: "frame", name: "Hero" });
  if (!section.ok) throw new Error(section.error.code);
  runCommand(ctx, createNode, { parentId: section.value, type: "frame", name: "Isi" });
  runCommand(ctx, updatePage, { id: about.value, patch: { seo: { title: "Tentang kami", description: "Profil" } } });
  return { doc, home, aboutId: about.value };
}

const summary = (doc: ReturnType<typeof siteWithPages>["doc"]) =>
  summarizePages(SiteDocumentSchema.parse(yDocToJson(doc)));

describe("summarizePages (read model site_pages)", () => {
  it("urut pageOrder: path, judul, seo, home, jumlah node (termasuk page)", () => {
    const { doc, home, aboutId } = siteWithPages();
    expect(summary(doc)).toEqual([
      { pageId: home, path: "/", title: "Beranda", seo: null, sortOrder: 0, isHome: true, nodeCount: 3 },
      {
        pageId: aboutId,
        path: "/tentang",
        title: "Tentang",
        seo: { title: "Tentang kami", description: "Profil" },
        sortOrder: 1,
        isHome: false,
        nodeCount: 1,
      },
    ]);
  });

  it("jadikan home → path bertukar & flag home pindah", () => {
    const { doc, home, aboutId } = siteWithPages();
    runCommand({ doc, origin: userOrigin("test") }, updatePage, { id: aboutId, patch: { isHome: true } });
    expect(summary(doc).map(({ pageId, path, isHome }) => ({ pageId, path, isHome }))).toEqual([
      { pageId: home, path: "/tentang", isHome: false },
      { pageId: aboutId, path: "/", isHome: true },
    ]);
  });

  it("id di pageOrder yang bukan page dilewati", () => {
    const { doc } = siteWithPages();
    const json = SiteDocumentSchema.parse(yDocToJson(doc));
    expect(summarizePages({ nodes: json.nodes, pageOrder: ["tidak_ada", ...json.pageOrder] })).toHaveLength(2);
  });
});
