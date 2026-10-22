import type { ComponentDefinition } from "@platform/document-model";
import { describe, expect, it } from "vitest";
import { renderComponentPreview } from "./component-preview";

// CMP-014: preview component → HTML statis responsif (dipakai thumbnail processor).
const DEFINITION: ComponentDefinition = {
  schemaVersion: 1,
  id: "cmp_preview01",
  version: 1,
  name: "PreviewCard",
  category: "card",
  propsSchema: [],
  rootId: "n_root0001",
  nodes: {
    n_root0001: {
      id: "n_root0001",
      type: "frame",
      name: "Root",
      parentId: null,
      visible: true,
      locked: false,
      tag: "div",
      children: ["n_text0001"],
      style: { base: {} },
      props: {},
    },
    n_text0001: {
      id: "n_text0001",
      type: "text",
      name: "Title",
      parentId: "n_root0001",
      visible: true,
      locked: false,
      tag: "p",
      style: { base: {} },
      props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] } },
    },
  },
};

describe("renderComponentPreview", () => {
  it("menghasilkan HTML statis berisi konten component + CSS inline", () => {
    const { html, css } = renderComponentPreview(DEFINITION, { assetUrl: (id) => `/assets/${id}` });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Hello"); // teks default child ter-resolve & dirender
    expect(html).toContain("<style>");
    expect(css.length).toBeGreaterThan(0);
  });

  it("deterministik: input sama → output byte-identik", () => {
    const a = renderComponentPreview(DEFINITION, { assetUrl: (id) => `/assets/${id}` });
    const b = renderComponentPreview(DEFINITION, { assetUrl: (id) => `/assets/${id}` });
    expect(a.html).toBe(b.html);
  });
});
