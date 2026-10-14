import type { SiteDocument } from "@platform/document-model";
import { heroDocument, responsiveSectionsDocument, styledDocument } from "@platform/document-model/fixtures";
import { describe, expect, it } from "vitest";
import { breakpointScopeClasses, buildPageStyles } from "./stylesheet";

// T1.10.3: breakpoint CSS — publish = media query, editor = scope class frame (ADR-013), dari sumber yang sama.
const assetUrl = (assetId: string) => `https://cdn.test/${assetId}`;
const build = (doc: SiteDocument, target: "publish" | "editor", pageId = "pg_home000001") =>
  buildPageStyles(doc, { pageId, assetUrl, target, rootSelector: target === "editor" ? ":host" : ":root" });

// Normalisasi keduanya ke bentuk "breakpoint → daftar aturan" untuk membandingkan isi tanpa selector pembungkus.
function publishRules(css: string): Record<string, string[]> {
  const result: Record<string, string[]> = { base: [], tablet: [], mobile: [] };
  const [base = "", ...blocks] = css.split("@media ");
  result.base = splitRules(base.replace(":root{", "ROOT{"));
  for (const block of blocks) {
    const bp = block.startsWith("(max-width:991px)") ? "tablet" : "mobile";
    const body = block.slice(block.indexOf("{") + 1, -1);
    result[bp] = splitRules(body.replace(":root{", "ROOT{"));
  }
  return result;
}
function editorRules(css: string): Record<string, string[]> {
  const result: Record<string, string[]> = { base: [], tablet: [], mobile: [] };
  for (const rule of splitRules(css)) {
    const match = /^\.bp-(tablet|mobile)( |\{)/.exec(rule);
    if (!match) result.base?.push(rule.replace(":host{", "ROOT{"));
    else
      result[match[1] as string]?.push(
        rule.replace(/^\.bp-(tablet|mobile) /, "").replace(/^\.bp-(tablet|mobile)\{/, "ROOT{"),
      );
  }
  return result;
}
const splitRules = (css: string) => css.split(/(?<=\})/).filter(Boolean);

describe("dua mode dari sumber yang sama", () => {
  it.each([
    ["hero", heroDocument, "pg_home000001"],
    ["styled", styledDocument, "pg_home000001"],
    [
      "responsive-sections",
      () => responsiveSectionsDocument().document,
      responsiveSectionsDocument().document.pageOrder[0] as string,
    ],
  ])("%s: aturan publish & editor identik selain selector (AC T1.10.3)", (_, create, pageId) => {
    const publish = build(create(), "publish", pageId);
    const editor = build(create(), "editor", pageId);
    expect(editorRules(editor.css)).toEqual(publishRules(publish.css));
    expect(editor.classOf(pageId)).toBe(publish.classOf(pageId));
  });

  it("publish: satu blok @media per breakpoint, urutan base → tablet → mobile (PUB-042)", () => {
    const { css } = build(styledDocument(), "publish");
    expect(css.match(/@media/g)).toHaveLength(2);
    expect(css.indexOf("@media (max-width:991px)")).toBeLessThan(css.indexOf("@media (max-width:479px)"));
    expect(css).not.toContain(".bp-");
  });

  it("editor: tanpa media query; frame mobile memakai scope tablet + mobile", () => {
    const { css } = build(styledDocument(), "editor");
    expect(css).not.toContain("@media");
    expect(css).toContain(".bp-tablet .s-");
    expect(breakpointScopeClasses("base")).toBe("");
    expect(breakpointScopeClasses("tablet")).toBe("bp-tablet");
    expect(breakpointScopeClasses("mobile")).toBe("bp-tablet bp-mobile");
  });
});

describe("cascade override (DM-036, AC PUB-042)", () => {
  function docWithOverrides() {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    if (!hero) throw new Error("fixture berubah");
    hero.style.base.radius = { value: 4, unit: "px" };
    hero.style.tablet = { radius: { value: 8, unit: "px" } };
    hero.style.mobile = { radius: null };
    return doc;
  }

  it("override tablet berlaku di mobile kecuali ditimpa; null di mobile → revert (tidak bocor ke tablet)", () => {
    const { css } = build(docWithOverrides(), "publish");
    const rules = publishRules(css);
    expect(rules.tablet?.join("")).toMatch(/border-radius:8px/);
    expect(rules.mobile?.join("")).toMatch(/border-radius:revert/);
    expect(rules.tablet?.join("")).not.toMatch(/revert/);
  });

  it("arti `fill` mengikuti arah parent di breakpoint yang sama (row desktop → kolom mobile)", () => {
    const doc = heroDocument();
    const hero = doc.nodes.n_hero000001;
    const title = doc.nodes.n_herottl001;
    if (!hero || !title) throw new Error("fixture berubah");
    hero.style.base.layout = { mode: "flex", direction: "row" };
    hero.style.mobile = { layout: { direction: "column" } };
    title.style.base = { size: { width: { mode: "fill" } } };
    title.style.tablet = undefined;
    title.style.mobile = undefined;
    const styles = build(doc, "publish");
    const titleClass = styles.classOf("n_herottl001") as string;
    const rules = publishRules(styles.css);
    expect(rules.base?.find((rule) => rule.startsWith(`.${titleClass}{`))).toContain("flex:1 1 0");
    expect(rules.mobile?.find((rule) => rule.startsWith(`.${titleClass}{`))).toMatch(/align-self:stretch.*flex:revert/);
  });

  it("nilai breakpoint dibaca dari settings", () => {
    const doc = styledDocument();
    const tablet = doc.settings.breakpoints.find((bp) => bp.id === "tablet");
    if (tablet) tablet.maxWidth = 1023;
    expect(build(doc, "publish").css).toContain("@media (max-width:1023px)");
  });
});

describe("token responsif", () => {
  it("varian mobile token typography → override variabel di media query / scope frame", () => {
    const doc = styledDocument();
    const title = doc.nodes.n_herottl001;
    if (title) title.style.base.typography = { $token: "typography.h1" };
    const publish = build(doc, "publish").css;
    expect(publish).toMatch(/@media \(max-width:479px\)\{:root\{[^}]*--t-typography-h1-font-size:34px/);
    const editor = build(doc, "editor").css;
    expect(editor).toMatch(/\.bp-mobile\{[^}]*--t-typography-h1-font-size:34px/);
    expect(editor).toMatch(/^:host\{/);
  });
});
