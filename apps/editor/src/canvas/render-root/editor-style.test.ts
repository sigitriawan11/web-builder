import { type Node, resolveStyle } from "@platform/document-model";
import { heroDocument } from "@platform/document-model/fixtures";
import { buildPageStyles } from "@platform/renderer";
import { describe, expect, it } from "vitest";
import { declarationsToStyle, editorNodeStyle } from "./editor-style";

const assetUrl = (id: string) => `/a/${id}`;

describe("declarationsToStyle", () => {
  it("kebab-case → camelCase; custom property & urutan (yang terakhir menang) dipertahankan", () => {
    expect(
      declarationsToStyle([
        ["background-color", "red"],
        ["--t-color-primary", "#000"],
        ["display", "flex"],
        ["display", "none"],
      ]),
    ).toEqual({ backgroundColor: "red", "--t-color-primary": "#000", display: "none" });
  });
});

describe("editorNodeStyle (ED-017: deklarasi sama dengan publish)", () => {
  const doc = heroDocument();
  const ctx = { parent: "block" as const, theme: doc.theme, assetUrl, frameWidth: 1440 };

  it("setiap deklarasi stylesheet publish ada di style inline node yang sama", () => {
    const pageId = doc.pageOrder[0] ?? "";
    const css = buildPageStyles(doc, { pageId, assetUrl }).css;
    const hero = doc.nodes.n_hero000001 as Node;
    const style = editorNodeStyle(hero, resolveStyle(hero.style, "base", { theme: doc.theme }), ctx) as Record<
      string,
      unknown
    >;
    expect(Object.keys(style).length).toBeGreaterThan(2);
    for (const [property, value] of Object.entries(style)) {
      const kebab = property.startsWith("--") ? property : property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(css).toContain(`${kebab}:${value}`);
    }
  });

  it("page selebar frame breakpoint; node tersembunyi display:none (atribut hidden kalah oleh display inline)", () => {
    const page = doc.nodes[doc.pageOrder[0] ?? ""] as Node;
    expect(editorNodeStyle(page, resolveStyle(page.style, "base"), { ...ctx, frameWidth: 390 }).width).toBe(390);
    const hidden = { ...(doc.nodes.n_hero000001 as Node), visible: false } as Node;
    expect(editorNodeStyle(hidden, resolveStyle(hidden.style, "base"), ctx).display).toBe("none");
  });

  it("style efektif breakpoint (DM-036) masuk ke deklarasi", () => {
    const hero = doc.nodes.n_hero000001 as Node;
    const base = resolveStyle(hero.style, "base");
    const mobile = editorNodeStyle(hero, { ...base, display: "none" }, ctx);
    expect(editorNodeStyle(hero, base, ctx).display).not.toBe("none");
    expect(mobile.display).toBe("none");
  });
});
