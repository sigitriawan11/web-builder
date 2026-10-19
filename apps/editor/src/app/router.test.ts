import { describe, expect, it } from "vitest";
import { editorUrl, libraryDraftUrl, parseEditorRoute } from "./router";

const SITE = "0199f0aa-1234-7abc-8def-0123456789ab";
// Mode Admin memakai UUID component (konsisten dengan API admin).
const CMP = "0199f0bb-5678-7abc-8def-0123456789cd";

describe("parseEditorRoute", () => {
  it.each([
    ["/editor/", "", { kind: "playground" }],
    ["/editor", "", { kind: "playground" }],
    [`/editor/${SITE}`, "", { kind: "site", siteId: SITE, pageId: null }],
    [`/editor/${SITE}/`, "?page=pg_home000001", { kind: "site", siteId: SITE, pageId: "pg_home000001" }],
    [`/editor/${SITE.toUpperCase()}`, "", { kind: "site", siteId: SITE, pageId: null }],
    // `?page=` tidak valid diabaikan (page default dipilih editor).
    [`/editor/${SITE}`, "?page=<script>", { kind: "site", siteId: SITE, pageId: null }],
    ["/editor/bukan-uuid", "", { kind: "not-found" }],
    [`/editor/${SITE}/lain`, "", { kind: "not-found" }],
    ["/lain", "", { kind: "not-found" }],
    // Mode Admin library (CMP-010) — UUID component.
    [`/editor/library/components/${CMP}/draft`, "", { kind: "library", componentId: CMP }],
    [`/editor/library/components/${CMP}/draft/`, "", { kind: "library", componentId: CMP }],
    [`/editor/library/components/${CMP.toUpperCase()}/draft`, "", { kind: "library", componentId: CMP }],
    ["/editor/library/components/cmp_button01/draft", "", { kind: "not-found" }],
    ["/editor/library/components/bukan-id/draft", "", { kind: "not-found" }],
    [`/editor/library/components/${CMP}`, "", { kind: "not-found" }],
  ] as const)("%s%s", (pathname, search, expected) => {
    expect(parseEditorRoute(pathname, search)).toEqual(expected);
  });

  it("editorUrl", () => {
    expect(editorUrl(SITE)).toBe(`/editor/${SITE}`);
    expect(editorUrl(SITE, "pg_home000001")).toBe(`/editor/${SITE}?page=pg_home000001`);
  });

  it("libraryDraftUrl", () => {
    expect(libraryDraftUrl(CMP)).toBe(`/editor/library/components/${CMP}/draft`);
    expect(() => libraryDraftUrl("bukan-id")).toThrow();
  });
});
