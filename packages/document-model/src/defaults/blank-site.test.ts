import { describe, expect, it } from "vitest";
import { SiteDocumentSchema } from "../schema";
import { siteDocumentFromState, siteDocumentToState } from "../yjs/state";
import { createBlankSiteDocument } from "./blank-site";

describe("createBlankSiteDocument (ACC-051 blank)", () => {
  it("1 page Home di '/' (isHome), tanpa node lain, lolos validasi strict", () => {
    const doc = createBlankSiteDocument({ title: "Toko Kue Bu Sri" });
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);
    expect(doc.meta).toEqual({ title: "Toko Kue Bu Sri", createdWith: "blank" });
    expect(doc.pageOrder).toHaveLength(1);
    const home = doc.nodes[doc.pageOrder[0] ?? ""];
    expect(home).toMatchObject({ type: "page", props: { path: "/", title: "Beranda", isHome: true }, children: [] });
    expect(doc.settings).toMatchObject({ language: "id", seo: { titleTemplate: "%s · Toko Kue Bu Sri" } });
    expect(Object.keys(doc.nodes)).toHaveLength(1);
  });

  it("bahasa website mengikuti bahasa UI pembuat (AC DM-005): en → judul Home", () => {
    const doc = createBlankSiteDocument({ title: "Cake Shop", language: "en" });
    expect(doc.settings.language).toBe("en");
    expect(doc.nodes[doc.pageOrder[0] ?? ""]).toMatchObject({ props: { title: "Home" } });
  });

  it("ID page baru setiap dokumen", () => {
    const a = createBlankSiteDocument({ title: "A" });
    const b = createBlankSiteDocument({ title: "B" });
    expect(a.pageOrder[0]).not.toBe(b.pageOrder[0]);
    expect(a.pageOrder[0]).toMatch(/^pg_/);
  });

  it("state Yjs awal ↔ JSON bolak-balik identik", () => {
    const doc = createBlankSiteDocument({ title: "Toko", homeTitle: "Beranda" });
    expect(siteDocumentFromState(siteDocumentToState(doc))).toEqual(doc);
  });
});
