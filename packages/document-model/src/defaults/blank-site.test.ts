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
    expect(home).toMatchObject({ type: "page", props: { path: "/", title: "Home", isHome: true }, children: [] });
    expect(Object.keys(doc.nodes)).toHaveLength(1);
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
