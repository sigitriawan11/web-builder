import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  autolayoutDocument,
  freeformDocument,
  fullTopLevelDocument,
  heroDocument,
  minimalDocument,
  nestedDocument,
  richTextDocument,
  styledDocument,
  wrapGridDocument,
} from "../../test/fixtures/basic-documents";
import { landing200 } from "../../test/fixtures/landing-generator";
import { responsiveSectionsDocument } from "../../test/fixtures/responsive-sections";
import { createBlankSiteDocument } from "../defaults/blank-site";
import { SiteDocumentSchema } from "../schema";
import { createSiteYDoc, jsonToYDoc, YDOC_KEYS, yDocToJson } from "./mapping";

// Semua fixture (AC DM-002/DM-058: round-trip lossless untuk SEMUA fixture).
const fixtures = [
  { name: "minimal", create: minimalDocument },
  { name: "hero", create: heroDocument },
  { name: "nested", create: nestedDocument },
  { name: "freeform", create: freeformDocument },
  { name: "autolayout", create: autolayoutDocument },
  { name: "wrapGrid", create: wrapGridDocument },
  { name: "landing200", create: landing200 },
  { name: "responsiveSections", create: () => responsiveSectionsDocument().document },
  { name: "fullTopLevel", create: fullTopLevelDocument },
  { name: "richText", create: richTextDocument },
  { name: "styled", create: styledDocument },
];

describe("jsonToYDoc ↔ yDocToJson (DM-058)", () => {
  it.each(fixtures)("round-trip lossless untuk fixture $name", ({ create }) => {
    const doc = SiteDocumentSchema.parse(create());

    const roundTripped = SiteDocumentSchema.parse(yDocToJson(jsonToYDoc(doc)));

    expect(roundTripped).toEqual(doc);
  });

  it.each(fixtures)("round-trip lewat encoding biner Yjs untuk fixture $name", ({ create }) => {
    const doc = create();
    const update = Y.encodeStateAsUpdate(jsonToYDoc(doc));

    const replica = new Y.Doc();
    Y.applyUpdate(replica, update);

    expect(SiteDocumentSchema.parse(yDocToJson(replica))).toEqual(doc);
  });

  it("menyimpan node, children, dan style sebagai shared type granular", () => {
    const ydoc = jsonToYDoc(heroDocument());
    const yNodes = ydoc.getMap<Y.Map<unknown>>(YDOC_KEYS.nodes);
    const yHero = yNodes.get("n_hero000001");

    expect(yHero).toBeInstanceOf(Y.Map);
    expect(yHero?.get("name")).toBe("Hero");
    expect(yHero?.get("children")).toBeInstanceOf(Y.Array);
    expect(yHero?.get("props")).toBeInstanceOf(Y.Map);

    const yStyle = yHero?.get("style");
    expect(yStyle).toBeInstanceOf(Y.Map);
    const yBase = (yStyle as Y.Map<Y.Map<unknown>>).get("base");
    expect(yBase).toBeInstanceOf(Y.Map);
    expect([...(yBase?.keys() ?? [])].sort()).toEqual(["fills", "layout", "radius", "size"]);

    // Node daun tidak punya children.
    expect(yNodes.get("n_herottl001")?.has("children")).toBe(false);
  });

  it("menulis seluruh dokumen dalam satu transaksi dengan origin yang diberikan", () => {
    const ydoc = new Y.Doc();
    const origin = { kind: "system", reason: "import" };
    const origins: unknown[] = [];
    ydoc.on("afterTransaction", (transaction) => origins.push(transaction.origin));

    jsonToYDoc(heroDocument(), ydoc, origin);

    expect(origins).toEqual([origin]);
  });

  it("tidak berbagi referensi objek antara JSON dan Y.Doc", () => {
    const doc = heroDocument();
    const ydoc = jsonToYDoc(doc);
    const expected = heroDocument();

    // Mengubah input setelah ditulis tidak boleh mengubah Y.Doc.
    // (mutasi isi nilai daun, karena nilai daun itulah yang disimpan Yjs per referensi)
    const heroInput = doc.nodes.n_hero000001;
    if (heroInput?.type !== "frame") throw new Error("fixture berubah");
    heroInput.style.base.fills?.push({ type: "solid", color: "#000000" });
    if (heroInput.style.base.layout?.mode === "flex") heroInput.style.base.layout.direction = "row";

    // Mengubah output tidak boleh mengubah Y.Doc.
    const output = SiteDocumentSchema.parse(yDocToJson(ydoc));
    const heroOutput = output.nodes.n_hero000001;
    if (heroOutput?.type !== "frame") throw new Error("fixture berubah");
    heroOutput.style.base.fills?.push({ type: "solid", color: "#000000" });
    if (heroOutput.style.base.layout?.mode === "flex") heroOutput.style.base.layout.direction = "row";

    expect(SiteDocumentSchema.parse(yDocToJson(ydoc))).toEqual(expected);
  });
});

// T1.9.1: struktur final DM-058 & granularitas konflik.
describe("struktur Y.Doc final (DM-058)", () => {
  it("dokumen website blank (defaultTheme) round-trip lossless; guid = siteId", () => {
    const doc = createBlankSiteDocument({ title: "Toko Kue" });
    const ydoc = jsonToYDoc(doc, createSiteYDoc("0199f0aa-0000-7000-8000-000000000001"));
    expect(ydoc.guid).toBe("0199f0aa-0000-7000-8000-000000000001");
    expect(SiteDocumentSchema.parse(yDocToJson(ydoc))).toEqual(doc);
  });

  it("theme: tokens Y.Map per grup → per nama, fonts Y.Array; settings atomik per key", () => {
    const ydoc = jsonToYDoc(fullTopLevelDocument());
    const yTheme = ydoc.getMap<unknown>(YDOC_KEYS.theme);
    const yTokens = yTheme.get("tokens") as Y.Map<Y.Map<unknown>>;
    expect(yTokens).toBeInstanceOf(Y.Map);
    expect(yTokens.get("color")).toBeInstanceOf(Y.Map);
    expect(yTokens.get("color")?.get("brand")).toEqual({ 600: "#9a3412" });
    expect(yTheme.get("fonts")).toBeInstanceOf(Y.Array);
    const ySettings = ydoc.getMap<unknown>(YDOC_KEYS.settings);
    expect([...ySettings.keys()].sort()).toEqual([
      "autoResponsive",
      "breakpoints",
      "language",
      "manualResponsive",
      "seo",
    ]);
    expect(ySettings.get("seo")).not.toBeInstanceOf(Y.Map);
  });

  it("edit konkuren pada style group / token berbeda tidak saling menimpa; group yang sama = last-writer-wins", () => {
    const base = Y.encodeStateAsUpdate(jsonToYDoc(heroDocument()));
    const [a, b] = [new Y.Doc(), new Y.Doc()];
    Y.applyUpdate(a, base);
    Y.applyUpdate(b, base);
    const baseStyle = (doc: Y.Doc) => {
      const yStyle = doc.getMap<Y.Map<unknown>>(YDOC_KEYS.nodes).get("n_hero000001")?.get("style");
      return (yStyle as Y.Map<Y.Map<unknown>> | undefined)?.get("base");
    };
    const tokens = (doc: Y.Doc) =>
      (doc.getMap<unknown>(YDOC_KEYS.theme).get("tokens") as Y.Map<Y.Map<unknown>>).get("color");

    baseStyle(a)?.set("fills", [{ type: "solid", color: "#111111" }]);
    baseStyle(b)?.set("radius", { value: 4, unit: "px" });
    tokens(a)?.set("primary", "#000000");
    tokens(b)?.set("accent", "#FFFFFF");
    a.getMap<unknown>(YDOC_KEYS.settings).set("manualResponsive", true);
    b.getMap<unknown>(YDOC_KEYS.settings).set("language", "en");

    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const merged = SiteDocumentSchema.parse(yDocToJson(a));
    expect(SiteDocumentSchema.parse(yDocToJson(b))).toEqual(merged);
    expect(merged.nodes.n_hero000001?.style.base).toMatchObject({
      fills: [{ type: "solid", color: "#111111" }],
      radius: { value: 4, unit: "px" },
    });
    expect(merged.theme.tokens.color).toMatchObject({ primary: "#000000", accent: "#FFFFFF" });
    expect(merged.settings).toMatchObject({ manualResponsive: true, language: "en" });
  });

  it("Y.Doc kosong/rusak tidak crash: hasilnya ditolak schema, bukan exception", () => {
    expect(() => yDocToJson(new Y.Doc())).not.toThrow();
    expect(SiteDocumentSchema.safeParse(yDocToJson(new Y.Doc())).success).toBe(false);
  });
});
