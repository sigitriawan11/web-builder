import { describe, expect, it } from "vitest";
import { heroDocument, richTextDocument } from "../../test/fixtures/basic-documents";
import { siteDocumentFromState, siteDocumentToState } from "../yjs";
import { AssetRefSchema } from "./asset-ref";
import { SiteDocumentSchema } from "./document";
import type { Node, SiteDocument } from "./index";
import { ImagePropsSchema } from "./nodes";

// T1.8.8: node image + AssetRef & registry assets (DM-014, DM-057).
const IMG = "n_heroimg001";
type ImageNode = Extract<Node, { type: "image" }>;
const image = (doc: SiteDocument) => doc.nodes[IMG] as ImageNode;
const issues = (doc: SiteDocument) =>
  (SiteDocumentSchema.safeParse(doc).error?.issues ?? []).map((issue) => `${issue.path.join(".")}: ${issue.message}`);

describe("AssetRef (DM-057)", () => {
  it("crop & focalPoint ternormalisasi 0..1", () => {
    const ok = {
      assetId: "ast_cake000001",
      focalPoint: { x: 0.3, y: 0.7 },
      crop: { x: 0.1, y: 0, width: 0.9, height: 1 },
    };
    expect(AssetRefSchema.safeParse(ok).success).toBe(true);
    for (const crop of [
      { x: -0.1, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0, width: 0, height: 0.5 },
      { x: 0.6, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.6 },
    ]) {
      expect(AssetRefSchema.safeParse({ assetId: "ast_cake000001", crop }).success, JSON.stringify(crop)).toBe(false);
    }
    expect(AssetRefSchema.safeParse({ assetId: "ast_cake000001", url: "https://cdn/x.jpg" }).success).toBe(false);
  });

  it("image props menerima link (LinkValue) dan menolak link tak dikenal", () => {
    const base = { image: { assetId: "ast_cake000001" }, fit: "cover" };
    expect(ImagePropsSchema.safeParse({ ...base, link: { type: "page", pageId: "pg_about00001" } }).success).toBe(true);
    expect(ImagePropsSchema.safeParse({ ...base, link: { type: "js", code: "x" } }).success).toBe(false);
  });
});

describe("invariant registry assets (AC DM-057)", () => {
  it("fixture valid; assetId image yang tidak terdaftar ditolak dengan path tepat", () => {
    expect(issues(heroDocument())).toEqual([]);
    const doc = heroDocument();
    image(doc).props.image.assetId = "ast_missing001";
    expect(issues(doc)).toContain(`nodes.${IMG}.props.image.assetId: Asset "ast_missing001" tidak ada di assets`);
  });

  it("image harus merujuk asset gambar (image/svg)", () => {
    const doc = heroDocument();
    doc.assets.ast_video00001 = { kind: "video", mime: "video/mp4" };
    image(doc).props.image.assetId = "ast_video00001";
    expect(issues(doc).join("\n")).toMatch(/bukan gambar \(video\)/);
  });

  it("rujukan di link image, link rich text, dan font theme juga diperiksa", () => {
    const doc = heroDocument();
    image(doc).props.link = { type: "asset", assetId: "ast_brosur0001" };
    doc.theme.fonts.push({
      family: "Brand",
      source: "upload",
      assetId: "ast_font000001",
      weights: [400],
      fallback: "sans-serif",
    });
    expect(issues(doc)).toEqual(
      expect.arrayContaining([
        `nodes.${IMG}.props.link.assetId: Asset "ast_brosur0001" tidak ada di assets`,
        `theme.fonts.0.assetId: Asset "ast_font000001" tidak ada di assets`,
      ]),
    );

    const rich = richTextDocument();
    const text = rich.nodes.n_richtext001;
    if (text?.type !== "text") throw new Error("fixture berubah");
    text.props.content.content.push({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Unduh",
          marks: [{ type: "link", attrs: { link: { type: "asset", assetId: "ast_menu000001" } } }],
        },
      ],
    });
    expect(issues(rich).join("\n")).toMatch(
      /n_richtext001\.props\.content\.content\.2\..*assetId: Asset "ast_menu000001"/,
    );
  });

  it("crop, focalPoint, link selamat round-trip Yjs", () => {
    const doc = heroDocument();
    image(doc).props.image.crop = { x: 0.1, y: 0.2, width: 0.5, height: 0.5 };
    image(doc).props.image.focalPoint = { x: 0.25, y: 0.75 };
    image(doc).props.link = { type: "url", href: "https://contoh.id", newTab: true };
    expect(SiteDocumentSchema.parse(doc)).toEqual(doc);
    expect(siteDocumentFromState(siteDocumentToState(doc))).toEqual(doc);
  });
});
