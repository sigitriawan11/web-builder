import { BASE_CSS } from "@platform/renderer";
import { describe, expect, it } from "vitest";
import {
  canvasStyleSheet,
  DEFAULT_ISOLATION,
  isolationFromSearch,
  scopeCss,
  siteCssFromSearch,
  TEXT_EDITOR_CSS,
} from "./isolation";

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
    expect(scopeCss("* { box-sizing: content-box; }", ".pf-root")).toBe(
      ".pf-root, .pf-root * { box-sizing: content-box; }",
    );
    expect(scopeCss("h1, .title { color: red; } p{margin:0}", ".pf-root")).toBe(
      ".pf-root h1, .pf-root .title { color: red; } .pf-root p {margin:0}",
    );
  });
});

describe("canvasStyleSheet", () => {
  const siteCss = "* { font-family: serif; }";

  it("shadow: reset :host, reset renderer (= publish), CSS editor teks, lalu CSS situs apa adanya", () => {
    expect(canvasStyleSheet("shadow", siteCss).split("\n")).toEqual([
      ":host { all: initial; display: block; }",
      BASE_CSS,
      TEXT_EDITOR_CSS,
      siteCss,
    ]);
  });

  it("prefix: reset .pf-root, lalu CSS editor teks & CSS situs di-scope", () => {
    const [reset, baseCss, editorCss, scopedSite] = canvasStyleSheet("prefix", siteCss).split("\n");
    expect(reset).toBe(".pf-root { all: initial; display: block; }");
    expect(baseCss).toContain(".pf-root, .pf-root *, .pf-root *::before, .pf-root *::after {box-sizing:border-box}");
    expect(editorCss).toContain(".pf-root .ProseMirror {");
    expect(scopedSite).toBe(".pf-root, .pf-root * { font-family: serif; }");
  });

  it("none: CSS situs global tanpa perlindungan (hanya reset renderer yang di-scope ke isi canvas)", () => {
    const [baseCss, ...rest] = canvasStyleSheet("none", siteCss).split("\n");
    expect(baseCss).toContain(
      ".render-root, .render-root * {box-sizing:border-box}".replace(
        " {",
        ", .render-root *::before, .render-root *::after {",
      ),
    );
    expect(rest).toEqual([TEXT_EDITOR_CSS, siteCss]);
  });
});
