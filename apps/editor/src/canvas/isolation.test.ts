import { describe, expect, it } from "vitest";
import { DEFAULT_ISOLATION, isolationFromSearch, siteCssFromSearch } from "./isolation";

describe("isolationFromSearch", () => {
  it.each([
    ["", DEFAULT_ISOLATION],
    ["?isolation=shadow", "shadow"],
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
