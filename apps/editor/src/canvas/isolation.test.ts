import { describe, expect, it } from "vitest";
import { canvasStyleSheet, DEFAULT_ISOLATION, isolationFromSearch, scopeCss, siteCssFromSearch } from "./isolation";

describe("isolationFromSearch", () => {
  it.each([
    ["", DEFAULT_ISOLATION],
    ["?isolation=shadow", "shadow"],
    ["?isolation=prefix", "prefix"],
    ["?isolation=none", "none"],
    ["?isolation=iframe", DEFAULT_ISOLATION],
  ])("%s → %s", (search, expected) => {
    expect(isolationFromSearch(search)).toBe(expected);
  });
});

describe("siteCssFromSearch", () => {
  it("hanya mengenal fixture yang terdaftar", () => {
    expect(siteCssFromSearch("?siteCss=aggressive")).toContain("font-family: serif");
    expect(siteCssFromSearch("?siteCss=<script>")).toBe("");
    expect(siteCssFromSearch("")).toBe("");
  });
});

describe("scopeCss (Opsi B)", () => {
  it("membatasi selector ke scope, termasuk selector universal & daftar selector", () => {
    expect(scopeCss("* { box-sizing: content-box; }", ".pf-root")).toBe(".pf-root, .pf-root * { box-sizing: content-box; }");
    expect(scopeCss("h1, .title { color: red; } p{margin:0}", ".pf-root")).toBe(
      ".pf-root h1, .pf-root .title { color: red; } .pf-root p {margin:0}",
    );
  });
});

describe("canvasStyleSheet", () => {
  const siteCss = "* { font-family: serif; }";

  it("shadow: reset :host + CSS situs apa adanya (sudah terisolasi shadow root)", () => {
    expect(canvasStyleSheet("shadow", siteCss)).toBe(":host { all: initial; display: block; }\n* { font-family: serif; }");
  });

  it("prefix: reset .pf-root + CSS situs di-scope", () => {
    expect(canvasStyleSheet("prefix", siteCss)).toBe(
      ".pf-root { all: initial; display: block; }\n.pf-root, .pf-root * { font-family: serif; }",
    );
  });

  it("none: CSS situs global tanpa perlindungan", () => {
    expect(canvasStyleSheet("none", siteCss)).toBe(siteCss);
  });
});
