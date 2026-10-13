// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { makeShadowRootDocumentLike } from "./shadow-root-compat";

describe("makeShadowRootDocumentLike (ADR-012, T0.8.5)", () => {
  it("menambah createRange & getSelection milik dokumen ke ShadowRoot", () => {
    const root = document.createElement("div").attachShadow({ mode: "open" }) as ShadowRoot & {
      createRange?: () => Range;
      getSelection?: () => Selection | null;
    };
    const original = (root as { getSelection?: unknown }).getSelection;
    makeShadowRootDocumentLike(root);

    expect(root.createRange?.()).toBeInstanceOf(Range);
    // getSelection bawaan (Chromium) dipertahankan; jika tidak ada, memakai milik dokumen.
    if (typeof original === "function") expect(root.getSelection).toBe(original);
    else expect(root.getSelection?.()).toBe(document.getSelection());
  });

  it("aman dipanggil berulang (StrictMode memakai ulang shadow root)", () => {
    const root = document.createElement("div").attachShadow({ mode: "open" });
    makeShadowRootDocumentLike(root);
    expect(() => makeShadowRootDocumentLike(root)).not.toThrow();
  });
});
