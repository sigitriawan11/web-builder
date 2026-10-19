import { type ComponentDefinition, createBlankSiteDocument, type SiteDocument } from "@platform/document-model";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RenderContext } from "./context";
import { buildPageStyles } from "./css/stylesheet";
import { render } from "./render";
import { renderToStaticHtml } from "./static";

const label = { id: "L", en: "L" };
const buttonDef = {
  schemaVersion: 1,
  id: "cmp_btn0001",
  version: 1,
  name: "Button",
  category: "button",
  propsSchema: [{ key: "label", label, type: "text", default: "Klik" }],
  variantAxes: [{ name: "tone", options: ["primary", "ghost"], default: "primary" }],
  variants: [],
  rootId: "n_btnroot01",
  nodes: {
    n_btnroot01: {
      id: "n_btnroot01",
      type: "frame",
      name: "Button",
      parentId: null,
      visible: true,
      locked: false,
      tag: "div",
      children: ["n_btnlabel1"],
      style: { base: {} },
      props: { role: "button" },
    },
    n_btnlabel1: {
      id: "n_btnlabel1",
      type: "text",
      name: "Label",
      parentId: "n_btnroot01",
      visible: true,
      locked: false,
      tag: "span",
      style: { base: {} },
      props: { content: { $prop: "label" } },
    },
  },
} as unknown as ComponentDefinition;

function docWithInstance(): { doc: SiteDocument; homeId: string } {
  const doc = createBlankSiteDocument({ title: "X" });
  const homeId = doc.pageOrder[0] as string;
  const home = doc.nodes[homeId] as Extract<SiteDocument["nodes"][string], { type: "page" }>;
  doc.nodes.n_inst0001 = {
    id: "n_inst0001",
    type: "instance",
    name: "Btn",
    parentId: homeId,
    visible: true,
    locked: false,
    style: { base: {} },
    props: { componentId: "cmp_btn0001", version: 1, propValues: { label: "Beli" } },
  };
  home.children.push("n_inst0001");
  doc.componentDeps = { cmp_btn0001: { version: 1, source: "library" } };
  return { doc, homeId };
}

const ctx = (homeId: string, mode: RenderContext["mode"], withRegistry = true): RenderContext => ({
  pageId: homeId,
  breakpoint: "base",
  mode,
  assetUrl: (id) => `/a/${id}`,
  ...(withRegistry
    ? { component: (id: string, v: number) => (id === "cmp_btn0001" && v === 1 ? buttonDef : undefined) }
    : {}),
});

describe("render instance (DM-051, T3.2.1)", () => {
  it("publish: instance diganti subtree ter-resolve ($prop → teks); tanpa data-instance-id", () => {
    const { doc, homeId } = docWithInstance();
    const html = renderToStaticMarkup(render(doc, ctx(homeId, "publish")));
    // Instance (n_inst0001) diganti subtree ter-resolve: frame root (div) → teks (span) berisi propValue "Beli".
    expect(html).toContain("<div><span>Beli</span></div>");
    expect(html).not.toContain("data-instance-id");
  });

  it("editor: root resolve membawa data-instance-id", () => {
    const { doc, homeId } = docWithInstance();
    const html = renderToStaticMarkup(render(doc, ctx(homeId, "editor")));
    expect(html).toContain('data-instance-id="n_inst0001"');
  });

  it("tanpa registry / component hilang → placeholder (tidak crash)", () => {
    const { doc, homeId } = docWithInstance();
    const noReg = renderToStaticMarkup(render(doc, ctx(homeId, "publish", false)));
    expect(noReg).not.toContain("Beli");
    const missing = renderToStaticMarkup(render(doc, { ...ctx(homeId, "publish"), component: () => undefined }));
    expect(missing).toContain("data-missing-component");
  });
});

// T3.2.1 (lanjutan): CSS untuk subtree instance ter-resolve — id scope (`<instId>:<defNodeId>`) di CSS cocok dengan
// class yang dipasang renderer. Definisi ber-style (root lebar tetap) agar menghasilkan deklarasi.
const rawNodes = (buttonDef as unknown as { nodes: Record<string, Record<string, unknown>> }).nodes;
const styledDef = {
  ...(buttonDef as unknown as Record<string, unknown>),
  nodes: {
    n_btnroot01: {
      ...rawNodes.n_btnroot01,
      style: { base: { size: { width: { mode: "fixed", value: 320, unit: "px" } } } },
    },
    n_btnlabel1: rawNodes.n_btnlabel1,
  },
} as unknown as ComponentDefinition;
const styledReg = (id: string, v: number) => (id === "cmp_btn0001" && v === 1 ? styledDef : undefined);

describe("instance CSS (T3.2.1)", () => {
  it("buildPageStyles memberi class ke node subtree ter-resolve + aturannya masuk CSS", () => {
    const { doc, homeId } = docWithInstance();
    const styles = buildPageStyles(doc, { pageId: homeId, assetUrl: (id) => `/a/${id}`, component: styledReg });
    const rootClass = styles.classOf("n_inst0001:n_btnroot01");
    expect(rootClass).toMatch(/^s-[0-9a-z]{6}$/);
    expect(styles.css).toContain(`.${rootClass}`);
    expect(styles.css).toContain("320px");
  });

  it("tanpa registry → tidak ada class untuk subtree (instance = placeholder)", () => {
    const { doc, homeId } = docWithInstance();
    const styles = buildPageStyles(doc, { pageId: homeId, assetUrl: (id) => `/a/${id}` });
    expect(styles.classOf("n_inst0001:n_btnroot01")).toBeUndefined();
  });

  it("renderToStaticHtml: elemen ter-resolve membawa class yang ada aturannya di CSS (end-to-end)", () => {
    const { doc, homeId } = docWithInstance();
    const { html, css } = renderToStaticHtml(doc, homeId, { assetUrl: (id) => `/a/${id}`, component: styledReg });
    const rootClass = buildPageStyles(doc, {
      pageId: homeId,
      assetUrl: (id) => `/a/${id}`,
      component: styledReg,
    }).classOf("n_inst0001:n_btnroot01");
    expect(rootClass).toBeTruthy();
    expect(html).toContain(`class="${rootClass}"`);
    expect(css).toContain(`.${rootClass}{`);
  });
});
