import type { SiteDocument } from "@platform/document-model";
import { heroDocument } from "@platform/document-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPageStyles } from "./css/stylesheet";
import { render } from "./render";

// T1.10.6: rich text & link aman (DM-013, DM-056, PUB-044). Dokumen di sini SENGAJA melewati validasi skema —
// renderer harus tetap aman (pertahanan berlapis, ARCHITECTURE §12).
const HOME = "pg_home000001";
const assetUrl = (assetId: string) => `https://cdn.test/${assetId}`;
const DANGEROUS = /<script|onerror=|onload=|javascript:|vbscript:|data:text|<\/style/i;

function withTitle(content: unknown): SiteDocument {
  const doc = heroDocument();
  const title = doc.nodes.n_herottl001;
  if (title?.type === "text") (title.props as { content: unknown }).content = content;
  return doc;
}
const paragraph = (...inlines: unknown[]) => ({ type: "doc", content: [{ type: "paragraph", content: inlines }] });
const html = (doc: SiteDocument) =>
  renderToStaticMarkup(render(doc, { pageId: HOME, breakpoint: "base", mode: "publish", assetUrl }));
const css = (doc: SiteDocument) => buildPageStyles(doc, { pageId: HOME, assetUrl }).css;

describe("teks di-escape", () => {
  it.each([
    "<script>alert(1)</script>",
    '"><img src=x onerror=alert(1)>',
    "</p><iframe src=javascript:alert(1)>",
    "<svg onload=alert(1)>",
  ])("%s", (payload) => {
    const output = html(withTitle(paragraph({ type: "text", text: payload })));
    expect(output).not.toMatch(/<script|<img src=x|<iframe|<svg/i);
    expect(output).toContain("&lt;");
  });
});

describe("whitelist node & mark rich text", () => {
  it("blok tak dikenal dibuang; mark tak dikenal dilepas (teks tetap)", () => {
    const doc = withTitle({
      type: "doc",
      content: [
        { type: "html", content: "<b onclick=alert(1)>x</b>" },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Aman", marks: [{ type: "script", attrs: { src: "x" } }] }],
        },
        { type: "paragraph", content: [{ type: "image", attrs: { src: "javascript:alert(1)" } }] },
      ],
    });
    const output = html(doc);
    expect(output).toContain("Aman");
    expect(output).not.toMatch(/onclick|<b |script|javascript:/i);
  });

  it("atribut blok dicek: align & start & level asing diabaikan", () => {
    const doc = withTitle({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { align: "center;background:url(javascript:1)" },
          content: [{ type: "text", text: "a" }],
        },
        {
          type: "orderedList",
          attrs: { start: '1" onclick="x' },
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] }],
        },
      ],
    });
    const output = html(doc);
    expect(output).not.toMatch(DANGEROUS);
    expect(output).not.toContain("onclick");
    expect(output).toContain("<ol><li>");
  });
});

describe("link disanitasi (DM-056)", () => {
  it.each([
    { type: "url", href: "javascript:alert(1)" },
    { type: "url", href: " JaVaScRiPt:alert(1)" },
    { type: "url", href: "data:text/html,<script>alert(1)</script>" },
    { type: "url", href: "vbscript:msgbox(1)" },
    { type: "url", href: "//evil.example" },
    { type: "phone", phone: '123"><script>alert(1)</script>' },
    { type: "whatsapp", phone: "62812javascript:" },
    { type: "page", pageId: "pg_about00001" },
  ])("%j → tanpa href berbahaya", (link) => {
    const doc = withTitle(paragraph({ type: "text", text: "klik", marks: [{ type: "link", attrs: { link } }] }));
    if (link.type === "page") {
      const about = doc.nodes.pg_about00001;
      if (about?.type === "page") (about.props as { path: string }).path = "javascript:alert(1)";
    }
    const output = html(doc);
    expect(output).not.toMatch(DANGEROUS);
    expect(output).not.toMatch(/href="(?!https:\/\/|\/|#|mailto:|tel:)/);
    // Nomor tidak valid → tanpa href sama sekali (bukan tautan rusak yang ter-escape).
    if (link.type === "phone" || link.type === "whatsapp") expect(output).not.toMatch(/href=/);
  });

  it("link aman tetap utuh", () => {
    const output = html(
      withTitle(
        paragraph({
          type: "text",
          text: "WA",
          marks: [
            { type: "link", attrs: { link: { type: "whatsapp", phone: "6281234567890", message: '"><script>' } } },
          ],
        }),
      ),
    );
    expect(output).toContain('href="https://wa.me/6281234567890?text=%22%3E%3Cscript%3E"');
  });
});

describe("injeksi CSS", () => {
  it("textStyle: warna/ukuran/font asing dinetralkan di atribut style", () => {
    const output = html(
      withTitle(
        paragraph({
          type: "text",
          text: "x",
          marks: [
            {
              type: "textStyle",
              attrs: {
                color: "red;background-image:url(javascript:alert(1))",
                fontSize: { value: "1px;background:url(x)", unit: "px" },
                fontFamily: 'x";background:url(javascript:1);"</style><script>',
              },
            },
          ],
        }),
      ),
    );
    // Nama font = satu string CSS berkutip (kutip di dalamnya di-escape) → isi string inert. Di luar string, tidak boleh
    // ada deklarasi sisipan atau tag.
    const style = output.slice(output.indexOf('style="') + 7, output.indexOf('">x<')).replaceAll("&quot;", '"');
    const outsideStrings = style.replace(/"(?:\\.|[^"\\])*"/g, '""');
    expect(outsideStrings).toBe('color:currentColor;font-size:0;font-family:""');
    expect(output).not.toMatch(/<script|<\/style/i);
  });

  it("path token & warna literal asing tidak menembus stylesheet; nama font tidak menutup <style>", () => {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    if (!hero) throw new Error("fixture berubah");
    hero.style.base.fills = [
      { type: "solid", color: { $token: "color.x);background:url(javascript:alert(1))" } },
      { type: "solid", color: "red;}</style><script>alert(1)</script>" },
    ] as never;
    hero.style.base.typography = { fontFamily: "</style><script>alert(1)</script>" };
    doc.theme.fonts.push({
      family: "</style><script>alert(1)</script>",
      source: "google",
      weights: [400],
      fallback: "sans-serif",
    });
    const output = css(doc);
    expect(output).not.toMatch(/<\/style|<script|javascript:alert\(1\)\)/i);
    expect(output).toContain("\\3c /style");
  });
});

describe("atribut node", () => {
  it("htmlId, alt, dan aria-label di-escape React", () => {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    const image = doc.nodes.n_heroimg001;
    if (!hero || image?.type !== "image") throw new Error("fixture berubah");
    hero.htmlId = '" onload="alert(1)' as never;
    hero.a11y = { label: '"><script>alert(1)</script>' };
    image.props.image.alt = '" onerror="alert(1)';
    const output = html(doc);
    expect(output).not.toMatch(/ onload="| onerror="|<script/);
    expect(output).toContain("&quot;");
  });
});
