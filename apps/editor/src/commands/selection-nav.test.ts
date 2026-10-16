import { nestedDocument } from "@platform/document-model/fixtures";
import { describe, expect, it } from "vitest";
import { navigateSelection } from "./selection-nav";

// ED-055: Enter (anak/edit teks), Shift+Enter / `\` (parent), Tab / Shift+Tab (sibling wrap).
// nestedDocument: pg_home → lvl1 → lvl2 → lvl3 → [lvl4text (teks, terkunci), lvl4img (image)].
const { nodes } = nestedDocument();
const lookup = (id: string) => nodes[id] ?? null;
const nav = (action: Parameters<typeof navigateSelection>[0], ids: string[]) => navigateSelection(action, ids, lookup);

describe("navigateSelection (ED-055)", () => {
  it("parent: Shift+Enter naik satu tingkat; page root tidak melakukan apa-apa", () => {
    expect(nav("parent", ["n_lvl2000001"])).toEqual({ type: "select", ids: ["n_lvl1000001"] });
    expect(nav("parent", ["n_lvl1000001"])).toEqual({ type: "select", ids: ["pg_home000001"] });
    expect(nav("parent", ["pg_home000001"])).toEqual({ type: "none" });
  });

  it("parent: seleksi jamak → parent unik", () => {
    expect(nav("parent", ["n_lvl4text001", "n_lvl4img0001"])).toEqual({ type: "select", ids: ["n_lvl3000001"] });
  });

  it("child: Enter memilih semua anak langsung; container tanpa anak → tidak ada efek", () => {
    expect(nav("child", ["n_lvl3000001"])).toEqual({ type: "select", ids: ["n_lvl4text001", "n_lvl4img0001"] });
    expect(nav("child", ["n_lvl4img0001"])).toEqual({ type: "none" });
  });

  it("child: Enter pada node teks masuk mode edit", () => {
    expect(nav("child", ["n_lvl4text001"])).toEqual({ type: "editText", id: "n_lvl4text001" });
  });

  it("sibling: Tab/Shift+Tab berpindah dengan wrap-around", () => {
    expect(nav("nextSibling", ["n_lvl4text001"])).toEqual({ type: "select", ids: ["n_lvl4img0001"] });
    expect(nav("nextSibling", ["n_lvl4img0001"])).toEqual({ type: "select", ids: ["n_lvl4text001"] });
    expect(nav("prevSibling", ["n_lvl4text001"])).toEqual({ type: "select", ids: ["n_lvl4img0001"] });
  });

  it("sibling: node tunggal di parent → wrap ke diri sendiri = tidak ada efek", () => {
    expect(nav("nextSibling", ["n_lvl1000001"])).toEqual({ type: "none" });
  });

  it("seleksi kosong atau tidak dikenal → tidak ada efek", () => {
    expect(nav("child", [])).toEqual({ type: "none" });
    expect(nav("parent", ["n_tidak_ada"])).toEqual({ type: "none" });
  });

  it("child & sibling hanya untuk seleksi tunggal", () => {
    expect(nav("child", ["n_lvl4text001", "n_lvl4img0001"])).toEqual({ type: "none" });
    expect(nav("nextSibling", ["n_lvl4text001", "n_lvl4img0001"])).toEqual({ type: "none" });
  });
});
