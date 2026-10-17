import type { SiteDocument, Style } from "@platform/document-model";
import { heroDocument, richTextDocument, styledDocument } from "@platform/document-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { render } from "../render";
import { constraintDeclarations, type DeclarationContext, nodeDeclarations, styleDeclarations } from "./declarations";
import { buildPageStyles } from "./stylesheet";
import { tokenDeclarations, usedTokens } from "./tokens";
import { cssString, tokenVarName } from "./values";

// T1.10.2: generator CSS — class per style-signature, token → CSS custom properties (PUB-026, PUB-043, DM-041).
const assetUrl = (assetId: string) => `https://cdn.test/${assetId}`;
const styles = (doc: SiteDocument) => buildPageStyles(doc, { pageId: "pg_home000001", assetUrl });
const theme = styledDocument().theme;
const decl = (style: Style, parent: DeclarationContext["parent"] = "block") =>
  Object.fromEntries(styleDeclarations(style, { parent, theme, assetUrl }));
const px = (value: number) => ({ value, unit: "px" as const });

describe("snapshot CSS fixture", () => {
  it.each([
    ["hero", heroDocument],
    ["styled", styledDocument],
    ["rich-text", richTextDocument],
  ])("%s", async (name, create) => {
    await expect(styles(create()).css).toMatchFileSnapshot(`../../test/__snapshots__/${name}.css`);
  });
});

describe("class per style-signature", () => {
  it("node dengan deklarasi identik berbagi class; tidak ada aturan duplikat (AC PUB-026)", () => {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    const page = doc.nodes.pg_home000001;
    if (hero?.type !== "frame" || page?.type !== "page") throw new Error("fixture berubah");
    doc.nodes.n_hero000002 = { ...structuredClone(hero), id: "n_hero000002", children: [] };
    doc.nodes.n_hero000003 = { ...structuredClone(hero), id: "n_hero000003", children: [] };
    page.children.push("n_hero000002", "n_hero000003");
    const { classOf, css } = styles(doc);
    expect(classOf("n_hero000002")).toBe(classOf("n_hero000003"));
    expect(classOf("n_hero000002")).toMatch(/^s-[0-9a-z]{6}$/);
    const rules = css.split("}").filter(Boolean);
    expect(new Set(rules).size).toBe(rules.length);
  });

  it("nama class stabil: style yang tidak berubah tetap memakai class yang sama (AC PUB-026)", () => {
    const before = styles(heroDocument());
    const doc = heroDocument();
    const image = doc.nodes.n_heroimg001;
    if (image) image.style.base.radius = px(4);
    const after = styles(doc);
    expect(after.classOf("n_herottl001")).toBe(before.classOf("n_herottl001"));
    expect(after.classOf("n_heroimg001")).not.toBe(before.classOf("n_heroimg001"));
  });

  it("node tersembunyi tidak mendapat aturan; integrasi dengan render (className)", () => {
    const doc = heroDocument();
    const image = doc.nodes.n_heroimg001;
    if (image) image.visible = false;
    const page = styles(doc);
    expect(page.classOf("n_heroimg001")).toBeUndefined();
    const html = renderToStaticMarkup(
      render(doc, {
        pageId: "pg_home000001",
        breakpoint: "base",
        mode: "publish",
        assetUrl,
        className: (node) => page.classOf(node.id),
      }),
    );
    expect(html).toContain(`<section class="${page.classOf("n_hero000001")}">`);
  });
});

describe("token → CSS custom properties (PUB-043)", () => {
  it("nama ber-prefix --t-, `type.*` = typography, grup bersarang", () => {
    expect(tokenVarName("color.primary")).toBe("--t-color-primary");
    expect(tokenVarName("type.h1")).toBe("--t-typography-h1");
    expect(tokenVarName("color.brand.600")).toBe("--t-color-brand-600");
  });

  it("hanya token terpakai (transitif lewat alias & field typography)", () => {
    const doc = styledDocument();
    doc.theme.tokens.color.primaryHover = { $token: "color.danger" };
    const title = doc.nodes.n_herottl001;
    if (title) title.style.base.color = { $token: "color.primaryHover" };
    const used = usedTokens(doc);
    expect(used).toContain("color.primaryHover");
    expect(used).toContain("color.danger");
    expect(used).not.toContain("color.warning");
    const root = tokenDeclarations(doc.theme, used).base;
    expect(root).toContainEqual(["--t-color-primaryHover", "var(--t-color-danger)"]);
  });

  it("typography komposit: satu variabel per field; node merujuk variabel field; varian responsif terpisah", () => {
    const doc = styledDocument();
    const decls = tokenDeclarations(doc.theme, new Set(["typography.h1", "fontFamily.heading"]));
    expect(decls.base).toEqual(
      expect.arrayContaining([
        ["--t-typography-h1-font-family", "var(--t-fontFamily-heading)"],
        ["--t-typography-h1-font-size", "48px"],
        ["--t-typography-h1-font-weight", "700"],
        ["--t-fontFamily-heading", '"Plus Jakarta Sans", sans-serif'],
      ]),
    );
    expect(decls.mobile).toContainEqual(["--t-typography-h1-font-size", "34px"]);
    expect(decl({ typography: { $token: "typography.h1" } })).toMatchObject({
      "font-size": "var(--t-typography-h1-font-size)",
      "line-height": "var(--t-typography-h1-line-height)",
    });
    expect(decl({ typography: { $token: "typography.h1" } })).not.toHaveProperty("letter-spacing");
  });

  it("mengubah nilai token hanya mengubah :root, aturan class tetap byte-identik (AC PUB-043)", () => {
    const before = styles(styledDocument()).css;
    const doc = styledDocument();
    doc.theme.tokens.color.primary = "#000000";
    const after = styles(doc).css;
    const rules = (css: string) => css.slice(css.indexOf("}") + 1);
    expect(after).not.toBe(before);
    expect(rules(after)).toBe(rules(before));
  });
});

describe("pemetaan style → CSS (spec 07 §4.2)", () => {
  it("sizing: fill sumbu utama/silang/blok, fixed + shrink, maxWidth mengizinkan menyusut, hug", () => {
    expect(decl({ size: { width: { mode: "fill" } } }, "row")).toEqual({ flex: "1 1 0", "min-width": "0" });
    expect(decl({ size: { width: { mode: "fill" } } }, "column")).toEqual({ "align-self": "stretch" });
    expect(decl({ size: { width: { mode: "fill" } } }, "block")).toEqual({ width: "100%" });
    expect(decl({ size: { width: { mode: "fixed", value: 320, unit: "px" } } }, "row")).toEqual({
      width: "320px",
      "flex-shrink": "0",
    });
    expect(
      decl({ size: { width: { mode: "fixed", value: 320, unit: "px" }, maxWidth: px(400) } }, "row"),
    ).toMatchObject({ "flex-shrink": "1" });
    expect(decl({ size: { height: { mode: "hug" } } })).toEqual({ height: "fit-content" });
  });

  it("transform (DM-033): translate → rotate → scale, flip = skala negatif, origin topLeft", () => {
    expect(decl({ transform: { rotate: 45 } })).toEqual({ transform: "rotate(45deg)" });
    expect(decl({ transform: { flipX: true } })).toEqual({ transform: "scale(-1, 1)" });
    expect(
      decl({
        transform: {
          translateX: px(10),
          translateY: { value: -4, unit: "px" },
          rotate: 90,
          scaleX: 2,
          flipY: true,
          origin: "topLeft",
        },
      }),
    ).toEqual({ transform: "translate(10px, -4px) rotate(90deg) scale(2, -1)", "transform-origin": "top left" });
    // origin center = default CSS → tidak ditulis; rotate 0 & scale 1 → tanpa transform.
    expect(decl({ transform: { rotate: 10, origin: "center" } })).toEqual({ transform: "rotate(10deg)" });
    expect(decl({ transform: { rotate: 0, scaleX: 1, scaleY: 1 } })).toEqual({});
  });

  it("layout flex: arah, gap utama/silang, padding sebagian, align/justify", () => {
    expect(
      decl({
        layout: {
          mode: "flex",
          direction: "row",
          wrap: true,
          gap: px(16),
          crossGap: px(8),
          padding: { top: px(4) },
          align: "center",
          justify: "spaceBetween",
        },
      }),
    ).toEqual({
      display: "flex",
      "flex-direction": "row",
      "flex-wrap": "wrap",
      "align-items": "center",
      "justify-content": "space-between",
      "row-gap": "8px",
      "column-gap": "16px",
      padding: "4px 0 0 0",
    });
  });

  it("fills: solid tunggal, berlapis (urutan dibalik), gambar (cover/tile, focal point), tersembunyi dilewati", () => {
    expect(decl({ fills: [{ type: "solid", color: { $token: "color.primary" }, opacity: 0.5 }] })).toEqual({
      "background-color": "color-mix(in srgb, var(--t-color-primary) 50%, transparent)",
    });
    const layered = decl({
      fills: [
        { type: "image", image: { assetId: "ast_bg00000001", focalPoint: { x: 0.5, y: 0.3 } }, fit: "cover" },
        { type: "solid", color: "#00000080" },
        { type: "solid", color: "#ffffff", visible: false },
      ],
    });
    expect(layered).toEqual({
      "background-image": 'linear-gradient(#00000080, #00000080), url("https://cdn.test/ast_bg00000001")',
      "background-size": "auto, cover",
      "background-repeat": "repeat, no-repeat",
      "background-position": "0 0, 50% 30%",
    });
  });

  it("stroke inside = border (per sisi), outside = outline; radius per sudut", () => {
    expect(decl({ strokes: [{ color: "#000000", width: px(1) }] })).toEqual({ border: "1px solid #000000" });
    expect(decl({ strokes: [{ color: "#000000", width: px(2), sides: { top: false, left: false } }] })).toEqual({
      "border-right": "2px solid #000000",
      "border-bottom": "2px solid #000000",
    });
    expect(decl({ strokes: [{ color: "#000000", width: px(2), position: "outside", style: "dashed" }] })).toEqual({
      outline: "2px dashed #000000",
      "outline-offset": "0",
    });
    expect(decl({ radius: { topLeft: px(8), bottomRight: { $token: "radius.md" } } })).toEqual({
      "border-top-left-radius": "8px",
      "border-bottom-right-radius": "var(--t-radius-md)",
    });
  });

  it("typography literal, color, flexChild, absolute, display none", () => {
    expect(
      decl({
        typography: { fontFamily: "Poppins", fontSize: px(16), lineHeight: 1.5, textDecoration: "lineThrough" },
        color: "#111111",
        flexChild: { alignSelf: "end", grow: 1 },
        position: { type: "absolute", x: 10, y: 20 },
        display: "none",
      }),
    ).toEqual({
      "font-family": '"Poppins", sans-serif',
      "font-size": "16px",
      "line-height": "1.5",
      "text-decoration": "line-through",
      color: "#111111",
      "align-self": "flex-end",
      "flex-grow": "1",
      position: "absolute",
      left: "10px",
      top: "20px",
      display: "none",
    });
  });

  it("deklarasi node: containing block, clipContent, frame berlink, gambar", () => {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    const image = doc.nodes.n_heroimg001;
    if (hero?.type !== "frame" || image?.type !== "image") throw new Error("fixture berubah");
    hero.props = { clipContent: true, link: { type: "url", href: "https://contoh.id" } };
    expect(Object.fromEntries(nodeDeclarations(hero, { layout: { mode: "flex", direction: "column" } }))).toEqual({
      position: "relative",
      overflow: "hidden",
      color: "inherit",
      "text-decoration": "none",
    });
    expect(Object.fromEntries(nodeDeclarations(image, {}))).toEqual({ display: "block", "object-fit": "cover" });
  });

  // ED-112 AC: clip content off (prop absen/false) → tidak ada `overflow:hidden`, anak boleh melimpah.
  it("deklarasi node: clipContent off → tanpa overflow", () => {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    if (hero?.type !== "frame") throw new Error("fixture berubah");
    hero.props = {};
    expect(
      Object.fromEntries(nodeDeclarations(hero, { layout: { mode: "flex", direction: "column" } })),
    ).not.toHaveProperty("overflow");
    hero.props = { clipContent: false };
    expect(
      Object.fromEntries(nodeDeclarations(hero, { layout: { mode: "flex", direction: "column" } })),
    ).not.toHaveProperty("overflow");
  });

  it("string CSS di-escape (nama font, URL)", () => {
    expect(cssString('Font "Aneh"\nBaris')).toBe('"Font \\"Aneh\\"\\a Baris"');
  });
});

describe("interaction states (DM-040)", () => {
  function docWithStates() {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    if (hero?.type !== "frame") throw new Error("fixture berubah");
    hero.style.states = {
      hover: { base: { fills: [{ type: "solid", color: "#ff0000" }] } },
      pressed: { base: { opacity: 0.5 } },
    };
    return doc;
  }

  it("publish: hover dibungkus @media(hover:hover); pressed → :active", () => {
    const page = styles(docWithStates());
    const cls = page.classOf("n_hero000001");
    expect(cls).toBeDefined();
    expect(page.css).toContain(`@media (hover:hover){.${cls}:hover{background-color:#ff0000}}`);
    expect(page.css).toContain(`.${cls}:active{opacity:0.5}`);
  });

  it("editor target: tidak mengemisikan aturan state (force-preview = task editor terpisah)", () => {
    const css = buildPageStyles(docWithStates(), { pageId: "pg_home000001", assetUrl, target: "editor" }).css;
    expect(css).not.toContain(":hover");
    expect(css).not.toContain(":active");
  });

  it("tanpa states: nama class & CSS tidak berubah (signature stabil)", () => {
    const before = styles(heroDocument());
    const after = styles(heroDocument());
    expect(after.css).toBe(before.css);
    expect(after.classOf("n_hero000001")).toBe(before.classOf("n_hero000001"));
  });
});

describe("constraintDeclarations (ED-098)", () => {
  const box = { x: 10, y: 20, width: 40, height: 30 };
  const parent = { width: 200, height: 100 };
  const decl = (h: Parameters<typeof constraintDeclarations>[2]) =>
    Object.fromEntries(constraintDeclarations(box, parent, h));

  it("default Left/Top → jarak dari tepi kiri/atas", () => {
    expect(decl(undefined)).toEqual({ left: "10px", top: "20px" });
  });

  it("Right/Bottom → jarak ke kanan/bawah (PW−X−W, PH−Y−H)", () => {
    expect(decl({ horizontal: "right", vertical: "bottom" })).toEqual({ right: "150px", bottom: "50px" });
  });

  it("Left&Right / Top&Bottom → melar, width/height auto", () => {
    expect(decl({ horizontal: "leftRight", vertical: "topBottom" })).toEqual({
      left: "10px",
      right: "150px",
      width: "auto",
      top: "20px",
      bottom: "50px",
      height: "auto",
    });
  });

  it("Center → 50% + margin (X−PW/2, Y−PH/2)", () => {
    expect(decl({ horizontal: "center", vertical: "center" })).toEqual({
      left: "50%",
      "margin-left": "-90px",
      top: "50%",
      "margin-top": "-30px",
    });
  });

  it("Scale → posisi & ukuran persen dari parent", () => {
    expect(decl({ horizontal: "scale", vertical: "scale" })).toEqual({
      left: "5%",
      width: "20%",
      top: "20%",
      height: "30%",
    });
  });

  it("tanpa ukuran parent → fallback Left/Top", () => {
    expect(Object.fromEntries(constraintDeclarations(box, {}, { horizontal: "right", vertical: "bottom" }))).toEqual({
      left: "10px",
      top: "20px",
    });
  });
});
