import type { Node, SiteDocument } from "@platform/document-model";
import { freeformDocument, heroDocument } from "@platform/document-model/fixtures";
import { describe, expect, it } from "vitest";
import { buildPageStyles } from "../css/stylesheet";
import { applyAutoResponsive } from "./auto-responsive";

// T1.10.4: aturan auto-responsive DM-038 — satu test input→output per rule.
const HOME = "pg_home000001";
const px = (value: number) => ({ value, unit: "px" as const });
const text = (id: string, parentId: string, value: string, tag?: "p" | "h1"): Node => ({
  id,
  type: "text",
  name: id,
  parentId,
  visible: true,
  locked: false,
  ...(tag ? { tag } : {}),
  style: { base: { size: { width: { mode: "hug" } } } },
  props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] } },
});

/** Page dengan satu frame row berisi dua teks. */
function rowDocument(first: string, second: string): SiteDocument {
  const doc = heroDocument();
  const page = doc.nodes[HOME];
  if (page?.type !== "page") throw new Error("fixture berubah");
  page.children = ["n_row0000001"];
  doc.pageOrder = [HOME];
  for (const id of Object.keys(doc.nodes)) if (id !== HOME) delete doc.nodes[id];
  doc.nodes.n_row0000001 = {
    id: "n_row0000001",
    type: "frame",
    name: "Row",
    parentId: HOME,
    children: ["n_rowa000001", "n_rowb000001"],
    visible: true,
    locked: false,
    style: { base: { layout: { mode: "flex", direction: "row", gap: px(16) }, size: { width: { mode: "fill" } } } },
    props: {},
  };
  doc.nodes.n_rowa000001 = text("n_rowa000001", "n_row0000001", first);
  doc.nodes.n_rowb000001 = text("n_rowb000001", "n_row0000001", second);
  return doc;
}

const auto = (doc: SiteDocument, bp: "tablet" | "mobile") =>
  applyAutoResponsive({ doc, pageId: HOME }, bp, doc.settings.autoResponsive);
const LONG = "Kue rumahan segar setiap hari untuk keluarga Anda";

describe("stackRows (mobile)", () => {
  it("row yang meluber ditumpuk: column + stretch, anak fill; autoApplied tercatat", () => {
    const result = auto(rowDocument(LONG, LONG), "mobile");
    expect(result.styleOf("n_row0000001")?.layout).toMatchObject({ direction: "column", align: "stretch" });
    expect(result.styleOf("n_rowa000001")?.size?.width).toEqual({ mode: "fill" });
    expect(result.autoApplied("n_row0000001")).toEqual(["stackRows"]);
    expect(result.autoApplied("n_rowb000001")).toEqual(["stackRows"]);
  });

  it("row yang muat tidak ditumpuk; role button & override direction (tablet/mobile) dihormati", () => {
    expect(auto(rowDocument("A", "B"), "mobile").autoApplied("n_row0000001")).toEqual([]);
    const button = rowDocument(LONG, LONG);
    const row = button.nodes.n_row0000001;
    if (row?.type === "frame") row.props.role = "button";
    expect(auto(button, "mobile").autoApplied("n_row0000001")).toEqual([]);
    for (const bp of ["tablet", "mobile"] as const) {
      const kept = rowDocument(LONG, LONG);
      const keptRow = kept.nodes.n_row0000001;
      if (keptRow) keptRow.style[bp] = { layout: { direction: "row" } };
      expect(auto(kept, "mobile").autoApplied("n_row0000001"), bp).toEqual([]);
    }
  });

  it("config: aturan dimatikan per id atau seluruhnya", () => {
    const doc = rowDocument(LONG, LONG);
    doc.settings.autoResponsive.rules.stackRows = false;
    expect(auto(doc, "mobile").autoApplied("n_row0000001")).toEqual([]);
    const off = rowDocument(LONG, LONG);
    off.settings.autoResponsive.enabled = false;
    expect(auto(off, "mobile").autoApplied("n_row0000001")).toEqual([]);
  });
});

describe("wrapRowsTablet (tablet)", () => {
  it("row yang meluber di tablet → wrap (bukan stack)", () => {
    const wide = "x".repeat(90);
    const result = auto(rowDocument(wide, wide), "tablet");
    expect(result.styleOf("n_row0000001")?.layout).toMatchObject({ direction: "row", wrap: true });
    expect(result.autoApplied("n_row0000001")).toEqual(["wrapRowsTablet"]);
    expect(auto(rowDocument(LONG, "B"), "tablet").autoApplied("n_row0000001")).toEqual([]);
  });
});

describe("gridColumns", () => {
  it("belum berlaku: layout grid belum ada di schema (P1 · M2)", () => {
    const result = auto(rowDocument(LONG, LONG), "mobile");
    for (const id of ["n_row0000001", "n_rowa000001"]) expect(result.autoApplied(id)).not.toContain("gridColumns");
  });
});

describe("fixedToFluid (mobile)", () => {
  it("lebar fixed px > lebar preview → fill dengan max-width asli; yang muat & yang di-override tidak", () => {
    const doc = rowDocument("A", "B");
    const row = doc.nodes.n_row0000001;
    if (!row) throw new Error("fixture berubah");
    row.style.base.size = { width: { mode: "fixed", value: 800, unit: "px" } };
    expect(auto(doc, "mobile").styleOf("n_row0000001")?.size).toEqual({ width: { mode: "fill" }, maxWidth: px(800) });
    row.style.base.size = { width: { mode: "fixed", value: 300, unit: "px" } };
    expect(auto(doc, "mobile").autoApplied("n_row0000001")).not.toContain("fixedToFluid");
    row.style.base.size = { width: { mode: "fixed", value: 800, unit: "px" } };
    row.style.mobile = { size: { width: { mode: "fixed", value: 360, unit: "px" } } };
    expect(auto(doc, "mobile").autoApplied("n_row0000001")).not.toContain("fixedToFluid");
  });
});

describe("absoluteToFlow (mobile)", () => {
  it("frame bebas lebih lebar dari preview → flex column, anak tanpa absolute, urut y lalu x", () => {
    const doc = freeformDocument();
    const result = applyAutoResponsive({ doc, pageId: HOME }, "mobile", doc.settings.autoResponsive);
    expect(result.styleOf("n_board00001")?.layout).toEqual({ mode: "flex", direction: "column" });
    expect(result.styleOf("n_fimage0001")?.position).toBeUndefined();
    // Kartu (80,80) → gambar (420,120) → teks (80,320).
    expect(result.declarationsOf("n_fcard00001")).toEqual([["order", "0"]]);
    expect(result.declarationsOf("n_fimage0001")).toEqual([["order", "1"]]);
    expect(result.declarationsOf("n_ftext00001")).toEqual([["order", "2"]]);
    expect(result.autoApplied("n_board00001")).toContain("absoluteToFlow");
  });
});

describe("scaleSpacing (mobile)", () => {
  it("padding/gap literal > 24px dikali spacingFactor; ≤ 24px & token tidak berubah", () => {
    const doc = rowDocument("A", "B");
    const row = doc.nodes.n_row0000001;
    if (!row) throw new Error("fixture berubah");
    row.style.base.layout = {
      mode: "flex",
      direction: "column",
      gap: px(40),
      padding: { top: px(64), bottom: px(20), left: { $token: "space.16" } },
    };
    const result = auto(doc, "mobile");
    expect(result.styleOf("n_row0000001")?.layout).toMatchObject({
      gap: px(24),
      padding: { top: px(38), bottom: px(20), left: { $token: "space.16" } },
    });
    expect(result.autoApplied("n_row0000001")).toContain("scaleSpacing");
    doc.settings.autoResponsive.mobileScale = { fontMin: 14, spacingFactor: 0.5 };
    expect(auto(doc, "mobile").styleOf("n_row0000001")?.layout).toMatchObject({
      gap: px(20),
      padding: { top: px(32) },
    });
  });
});

describe("scaleType (mobile)", () => {
  it("fontSize literal > 32px → clamp() (min = maks(fontMin, 60%)); ≤ 32px & token tidak", () => {
    const doc = rowDocument("A", "B");
    const title = doc.nodes.n_rowa000001;
    const other = doc.nodes.n_rowb000001;
    if (!title || !other) throw new Error("fixture berubah");
    title.style.base.typography = { fontSize: px(56) };
    other.style.base.typography = { fontSize: px(30) };
    const result = auto(doc, "mobile");
    expect(result.declarationsOf("n_rowa000001")).toEqual([["font-size", "clamp(34px, 10.77vw, 56px)"]]);
    expect(result.autoApplied("n_rowb000001")).not.toContain("scaleType");
    other.style.base.typography = { $token: "typography.h1" };
    expect(auto(doc, "mobile").autoApplied("n_rowb000001")).not.toContain("scaleType");
    title.style.mobile = { typography: { fontSize: px(40) } };
    expect(auto(doc, "mobile").declarationsOf("n_rowa000001")).toEqual([]);
  });
});

describe("integrasi buildPageStyles (AC: editor & publish memanggil fungsi yang sama)", () => {
  it("hasil aturan masuk CSS mobile kedua mode; autoApplied diekspos untuk panel editor", () => {
    const doc = rowDocument(LONG, LONG);
    for (const target of ["publish", "editor"] as const) {
      const styles = buildPageStyles(doc, { pageId: HOME, assetUrl: (id) => id, target });
      const rowClass = styles.classOf("n_row0000001") as string;
      const mobile =
        target === "publish" ? styles.css.slice(styles.css.indexOf("@media (max-width:479px)")) : styles.css;
      const selector = target === "publish" ? `.${rowClass}{` : `.bp-mobile .${rowClass}{`;
      const rule = mobile.slice(mobile.indexOf(selector), mobile.indexOf("}", mobile.indexOf(selector)));
      expect(rule).toContain("flex-direction:column");
      expect(rule).toContain("align-items:stretch");
      expect(styles.autoApplied("n_row0000001", "mobile")).toEqual(["stackRows"]);
      expect(styles.autoApplied("n_row0000001", "tablet")).toEqual(["wrapRowsTablet"]);
    }
  });
});
