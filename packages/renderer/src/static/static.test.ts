import type { SiteDocument } from "@platform/document-model";
import { generateLandingDocument, heroDocument, styledDocument } from "@platform/document-model/fixtures";
import { describe, expect, it } from "vitest";
import { renderToStaticHtml } from "./index";

// T1.10.7: renderer statis (DM-001, PUB-025, spec 07 §4.1).
/** Hero tanpa judul SEO khusus di home (fixture membawa `seo.title: "Beranda"`). */
function heroWithoutHomeSeo(): SiteDocument {
  const doc = heroDocument();
  const home = doc.nodes.pg_home000001;
  if (home?.type === "page") delete home.props.seo;
  return doc;
}
const assetUrl = (assetId: string) => `https://cdn.test/${assetId}`;
const page = (doc: SiteDocument, pageId = "pg_home000001", baseUrl?: string) =>
  renderToStaticHtml(doc, pageId, { assetUrl, ...(baseUrl ? { baseUrl } : {}) }).html;

describe("snapshot & determinisme", () => {
  it.each([
    ["hero-home", heroDocument, "pg_home000001"],
    ["hero-about", heroDocument, "pg_about00001"],
    ["styled-home", styledDocument, "pg_home000001"],
  ])("%s", async (name, create, pageId) => {
    await expect(page(create(), pageId, "https://tokokue.id")).toMatchFileSnapshot(
      `../../test/__snapshots__/${name}.static.html`,
    );
  });

  it("dua render identik byte-per-byte (AC PUB-025)", () => {
    expect(page(styledDocument())).toBe(page(styledDocument()));
  });

  it("tanpa runtime React, marker hydration, atribut editor, atau metadata (PUB-049, AC DM-008)", () => {
    const doc = styledDocument();
    const hero = doc.nodes.n_hero000001;
    if (hero) hero.metadata = { aiNote: "CATATAN-AI-RAHASIA", ext: { rahasia: "EXT-RAHASIA" }, createdBy: "ai" };
    const html = page(doc);
    expect(html).not.toMatch(/react|data-reactroot|data-node-id|<!--|<script|RAHASIA/i);
  });

  it("page tidak dikenal → error", () => {
    expect(() => renderToStaticHtml(heroDocument(), "n_hero000001", { assetUrl })).toThrow(/bukan page/);
  });
});

describe("kerangka HTML (spec 07 §4.1)", () => {
  it("doctype, lang, charset/viewport, CSS inline, skip link ke <main id=main>", () => {
    const html = page(heroDocument());
    expect(html).toMatch(/^<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport"/);
    expect(html).toMatch(/<style>\*,\*::before,\*::after\{box-sizing:border-box\}.*<\/style><\/head>/);
    expect(html).toMatch(/<body><a class="pf-skip" href="#main">Lewati ke konten<\/a><main [^>]*id="main"/);
    expect(html).toMatch(/<\/main><\/body><\/html>$/);
    const english = heroDocument();
    english.settings.language = "en-US";
    expect(page(english)).toContain(">Skip to content</a>");
  });

  it("judul: home = defaultTitle; page lain = template; judul SEO page menang", () => {
    const doc = heroWithoutHomeSeo();
    expect(page(doc)).toContain(`<title>${doc.settings.seo.defaultTitle}</title>`);
    const about = doc.nodes.pg_about00001;
    if (about?.type !== "page") throw new Error("fixture berubah");
    expect(page(doc, "pg_about00001")).toContain(
      `<title>${doc.settings.seo.titleTemplate.replace("%s", about.props.title)}</title>`,
    );
    const home = doc.nodes.pg_home000001;
    if (home?.type === "page") home.props.seo = { title: "Kue Ulang Tahun" };
    expect(page(doc)).toContain(`<title>${doc.settings.seo.titleTemplate.replace("%s", "Kue Ulang Tahun")}</title>`);
  });

  it("SEO: deskripsi (page > default), noindex, canonical (page > baseUrl), og:image, favicon", () => {
    const doc = heroDocument();
    doc.settings.seo.defaultDescription = "Kue rumahan di Bandung";
    doc.settings.favicon = { assetId: "ast_cake000001" };
    let html = page(doc, "pg_about00001", "https://tokokue.id/");
    expect(html).toContain('<meta name="description" content="Kue rumahan di Bandung">');
    expect(html).toContain('<link rel="canonical" href="https://tokokue.id/tentang">');
    expect(html).toContain('<meta property="og:url" content="https://tokokue.id/tentang">');
    expect(html).toContain('<link rel="icon" href="https://cdn.test/ast_cake000001">');
    expect(html).not.toContain("noindex");
    // noindex situs berlaku untuk semua page.
    doc.settings.seo.noIndex = true;
    expect(page(doc, "pg_about00001")).toContain('<meta name="robots" content="noindex">');
    doc.settings.seo.noIndex = false;

    const about = doc.nodes.pg_about00001;
    if (about?.type !== "page") throw new Error("fixture berubah");
    about.props.seo = {
      description: "Cerita kami",
      noIndex: true,
      canonical: "https://lain.id/x",
      ogImage: { assetId: "ast_cake000001" },
    };
    html = page(doc, "pg_about00001", "https://tokokue.id");
    expect(html).toContain('<meta name="description" content="Cerita kami">');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('<link rel="canonical" href="https://lain.id/x">');
    expect(html).toContain('<meta property="og:image" content="https://cdn.test/ast_cake000001">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it("nilai head di-escape (judul/deskripsi berisi tag)", () => {
    const doc = heroWithoutHomeSeo();
    doc.settings.seo.defaultTitle = "</title><script>alert(1)</script>";
    doc.settings.seo.defaultDescription = '"><script>alert(2)</script>';
    const html = page(doc);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;/title&gt;&lt;script&gt;");
  });
});

describe("kinerja (AC PUB-025, indikatif)", () => {
  it("10 page × 500 node < 3 detik", () => {
    const docs = Array.from({ length: 10 }, (_, seed) => generateLandingDocument({ nodeCount: 500, seed: seed + 1 }));
    const start = performance.now();
    for (const doc of docs) renderToStaticHtml(doc, doc.pageOrder[0] as string, { assetUrl });
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
