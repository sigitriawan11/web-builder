import { describe, expect, it } from "vitest";
import { heroDocument, styledDocument } from "../../test/fixtures/basic-documents";
import { publishIssues } from "../../test/validation";
import { mergeStyle } from "../ops/merge-style";
import { gcAssets } from "../query/assets";
import { resolveStyle } from "../query/resolve-style";
import type { SiteDocument } from "./index";
import { StylePatchSchema, StyleSchema } from "./style";

// T1.8.10: style model (DM-027, DM-028, DM-029, DM-030, DM-032, DM-034).
const issues = (doc: SiteDocument) => publishIssues(doc);
const valid = (style: unknown) => StyleSchema.safeParse(style).success;

describe("fixture semua kelompok style", () => {
  it("styledDocument valid", () => {
    expect(issues(styledDocument())).toEqual([]);
  });
});

describe("sizing (DM-027)", () => {
  it("fixed/hug/fill + min/max + aspectRatio", () => {
    expect(
      valid({
        size: {
          width: { mode: "fixed", value: 320, unit: "px" },
          height: { mode: "hug" },
          minWidth: { value: 50, unit: "%" },
          maxHeight: { $token: "size.container" },
          aspectRatio: 1.7778,
        },
      }),
    ).toBe(true);
    expect(valid({ size: { width: { mode: "fixed", value: -1, unit: "px" } } })).toBe(false);
    expect(valid({ size: { width: { mode: "fixed", value: 10, unit: "fr" } } })).toBe(false);
    expect(valid({ size: { width: { mode: "auto" } } })).toBe(false);
    expect(valid({ size: { minWidth: 100 } })).toBe(false);
    expect(valid({ size: { aspectRatio: 0 } })).toBe(false);
  });
});

describe("position (DM-028)", () => {
  it("flow tanpa x/y; absolute wajib x/y; fixed/sticky (P1) belum diterima", () => {
    expect(valid({ position: { type: "flow" } })).toBe(true);
    expect(
      valid({
        position: { type: "absolute", x: 0, y: 0, constraints: { horizontal: "scale", vertical: "topBottom" } },
      }),
    ).toBe(true);
    expect(valid({ position: { type: "flow", x: 10, y: 10 } })).toBe(false);
    expect(valid({ position: { type: "absolute", x: 10 } })).toBe(false);
    expect(valid({ position: { type: "sticky", top: { value: 0, unit: "px" } } })).toBe(false);
  });

  it("patch absolute → flow mengganti utuh (x/y hilang, AC DM-028)", () => {
    const base = StyleSchema.parse({ position: { type: "absolute", x: 10, y: 20 } });
    expect(resolveStyle({ base, mobile: { position: { type: "flow" } } }, "mobile").position).toEqual({ type: "flow" });
  });
});

describe("fills (DM-029)", () => {
  it("solid & image; maks 8; gradient (P1) belum diterima", () => {
    expect(valid({ fills: [{ type: "image", image: { assetId: "ast_bg00000001" }, fit: "tile" }] })).toBe(true);
    expect(valid({ fills: [{ type: "image", image: { assetId: "ast_bg00000001" }, fit: "fill" }] })).toBe(false);
    expect(valid({ fills: Array.from({ length: 9 }, () => ({ type: "solid", color: "#000000" })) })).toBe(false);
    expect(valid({ fills: [{ type: "linearGradient", angle: 90, stops: [] }] })).toBe(false);
  });

  it("asset fill gambar wajib terdaftar & dipertahankan gcAssets", () => {
    const doc = styledDocument();
    expect(Object.keys(gcAssets(doc).assets)).toContain("ast_bg00000001");
    delete doc.assets.ast_bg00000001;
    expect(issues(doc)).toContain(
      'nodes.n_hero000001.style.base.fills.0.image.assetId: Asset "ast_bg00000001" tidak ada di assets',
    );
  });
});

describe("strokes & radius (DM-030)", () => {
  it("stroke lengkap valid; maks 1 di M1; width wajib Length", () => {
    const stroke = { color: "#000000", width: { value: 2, unit: "px" }, style: "dashed", position: "outside" };
    expect(valid({ strokes: [stroke] })).toBe(true);
    expect(valid({ strokes: [stroke, stroke] })).toBe(false);
    expect(valid({ strokes: [{ ...stroke, width: 2 }] })).toBe(false);
    expect(valid({ strokes: [{ ...stroke, sides: { top: true, middle: true } }] })).toBe(false);
  });

  it("radius seragam atau per sudut", () => {
    expect(valid({ radius: { $token: "radius.md" } })).toBe(true);
    expect(valid({ radius: { bottomLeft: { value: 4, unit: "px" } } })).toBe(true);
    expect(valid({ radius: { topLeft: 4 } })).toBe(false);
  });
});

describe("typography & color (DM-032)", () => {
  it("objek field atau token komposit; nilai di luar domain ditolak", () => {
    expect(valid({ typography: { $token: "typography.h1" } })).toBe(true);
    expect(
      valid({ typography: { fontFamily: { $token: "fontFamily.heading" }, lineHeight: { value: 24, unit: "px" } } }),
    ).toBe(true);
    for (const typography of [
      { fontWeight: 450 },
      { fontWeight: 1000 },
      { lineHeight: 0 },
      { fontSize: 16 },
      { textDecoration: "line-through" },
      { $token: "typography.h1", fontSize: { value: 16, unit: "px" } },
    ]) {
      expect(valid({ typography }), JSON.stringify(typography)).toBe(false);
    }
    expect(valid({ color: "rgb(0,0,0)" })).toBe(false);
  });

  it("font literal yang tidak ada di theme.fonts ditolak (style & mark textStyle)", () => {
    const doc = styledDocument();
    doc.theme.fonts = [];
    expect(issues(doc)).toContain(
      'nodes.n_herottl001.style.base.typography.fontFamily: Font "Poppins" tidak terdaftar di theme.fonts',
    );

    const rich = heroDocument();
    const title = rich.nodes.n_herottl001;
    if (title?.type !== "text") throw new Error("fixture berubah");
    title.props.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Halo", marks: [{ type: "textStyle", attrs: { fontFamily: "Comic Sans" } }] },
          ],
        },
      ],
    };
    expect(issues(rich)).toContain(
      'nodes.n_herottl001.props.content.content.0.content.0.marks.0.attrs.fontFamily: Font "Comic Sans" tidak terdaftar di theme.fonts',
    );
  });

  it("patch typography di-merge per field; null menghapus; token komposit atomik", () => {
    const base = { typography: { fontWeight: 700, lineHeight: 1.2 } };
    expect(mergeStyle(base, { typography: { fontWeight: null, fontStyle: "italic" } })).toEqual({
      typography: { lineHeight: 1.2, fontStyle: "italic" },
    });
    expect(mergeStyle(base, { typography: { $token: "typography.h2" } })).toEqual({
      typography: { $token: "typography.h2" },
    });
    expect(mergeStyle({ typography: { $token: "typography.h1" } }, { typography: { fontWeight: 400 } })).toEqual({
      typography: { fontWeight: 400 },
    });
    expect(resolveStyle(styledDocument().nodes.n_herottl001?.style ?? { base: {} }, "tablet").typography).toMatchObject(
      {
        fontFamily: "Poppins",
        lineHeight: { value: 40, unit: "px" },
      },
    );
    expect(
      resolveStyle(styledDocument().nodes.n_herottl001?.style ?? { base: {} }, "tablet").typography,
    ).not.toHaveProperty("fontWeight");
  });
});

describe("style terlarang (DM-034)", () => {
  it.each(["customCss", "className", "css", "boxShadow", "fontSize"])("key %s ditolak di base & patch", (key) => {
    expect(valid({ [key]: "x" })).toBe(false);
    expect(StylePatchSchema.safeParse({ [key]: "x" }).success).toBe(false);
  });

  it("null hanya sah di patch, tidak di base", () => {
    expect(valid({ strokes: null })).toBe(false);
    expect(StylePatchSchema.safeParse({ strokes: null, typography: { fontWeight: null } }).success).toBe(true);
  });
});
