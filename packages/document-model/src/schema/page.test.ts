import { describe, expect, it } from "vitest";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { publishIssues } from "../../test/validation";
import { SiteDocumentSchema } from "./document";
import type { Node, SiteDocument } from "./index";

// T1.8.5: node page (DM-006, DM-010).
const HOME = "pg_home000001";
const ABOUT = "pg_about00001";

type PageNode = Extract<Node, { type: "page" }>;
const page = (doc: SiteDocument, id: string) => doc.nodes[id] as PageNode;
const issues = (doc: SiteDocument) => publishIssues(doc);

describe("page home & path (AC DM-010)", () => {
  it("fixture: tepat satu home di '/', path unik → valid", () => {
    expect(SiteDocumentSchema.safeParse(heroDocument()).success).toBe(true);
  });

  it("tanpa home atau dua home → ditolak", () => {
    const none = heroDocument();
    page(none, HOME).props.isHome = false;
    expect(issues(none)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^pageOrder: Harus tepat satu page isHome/)]),
    );

    const two = heroDocument();
    page(two, ABOUT).props.isHome = true;
    expect(issues(two).join("\n")).toMatch(/tepat satu page isHome \(ditemukan 2\)/);
  });

  it("home bukan di '/' → ditolak; path duplikat → ditolak", () => {
    const moved = heroDocument();
    page(moved, HOME).props.path = "/beranda";
    expect(issues(moved).join("\n")).toMatch(/home wajib di path "\/"/);

    const duplicate = heroDocument();
    page(duplicate, ABOUT).props.path = "/";
    expect(issues(duplicate).join("\n")).toMatch(/Path "\/" sudah dipakai/);
  });

  it.each(["/tentang-kami", "/produk/[slug]", "/a/b/c"])("path %s valid", (path) => {
    const doc = heroDocument();
    page(doc, ABOUT).props.path = path;
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it.each(["/Tentang", "/tentang/", "tentang", "/a b", "/produk/[Slug]", "//dobel"])("path %s ditolak", (path) => {
    const doc = heroDocument();
    page(doc, ABOUT).props.path = path;
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(false);
  });
});

describe("page SEO & canvas", () => {
  it("SEO per halaman: canonical http(s) saja; ogImage wajib terdaftar", () => {
    const doc = heroDocument();
    page(doc, ABOUT).props.seo = { title: "Tentang", canonical: "https://tokokue.id/tentang" };
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);

    page(doc, ABOUT).props.seo = { canonical: "javascript:alert(1)" };
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(false);

    page(doc, ABOUT).props.seo = { ogImage: { assetId: "ast_tidakada01" } };
    expect(issues(doc)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^nodes\.pg_about00001\.props\.seo\.ogImage\.assetId/)]),
    );
  });

  it("canvas.width editor-only dalam batas wajar", () => {
    const doc = heroDocument();
    page(doc, HOME).props.canvas = { width: 1280 };
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);
    page(doc, HOME).props.canvas = { width: 100 };
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(false);
  });
});

describe("layout page tetap (AC DM-010)", () => {
  it("flex kolom & lebar fill diterima; tidak diisi = default", () => {
    const doc = heroDocument();
    page(doc, HOME).style = {
      base: { layout: { mode: "flex", direction: "column" }, size: { width: { mode: "fill" } } },
      mobile: { layout: { gap: { value: 8, unit: "px" } } },
    };
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it.each([
    ["row di base", { base: { layout: { mode: "flex", direction: "row" } } }],
    ["mode none di base", { base: { layout: { mode: "none" } } }],
    ["lebar fixed", { base: { size: { width: { mode: "fixed", value: 1200, unit: "px" } } } }],
    ["row di override tablet", { base: {}, tablet: { layout: { direction: "row" } } }],
    ["mode none di override mobile", { base: {}, mobile: { layout: { mode: "none" } } }],
  ])("%s → ditolak", (_label, style) => {
    const doc = heroDocument();
    page(doc, HOME).style = style as PageNode["style"];
    expect(SiteDocumentSchema.safeParse(doc).success).toBe(false);
  });
});
