import { type ComponentDefinition, createBlankSiteDocument, type SiteDocument } from "@platform/document-model";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RenderContext } from "./context";
import { render } from "./render";

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
