import { describe, expect, it } from "vitest";
import { fontsourceUrl, siteFontFamilyName, siteFontFromSearch, siteFontStack } from "./site-fonts";

describe("site fonts (T0.4.7)", () => {
  it("nama family situs diberi namespace agar tidak bertabrakan dengan font chrome", () => {
    expect(siteFontFamilyName("Inter")).toBe("pf-site Inter");
    expect(siteFontStack("Playfair Display")).toBe('"pf-site Playfair Display", system-ui, sans-serif');
    expect(siteFontStack(null)).toBe("system-ui, sans-serif");
  });

  it("URL Fontsource subset latin per weight", () => {
    expect(fontsourceUrl("Playfair Display", 700)).toBe(
      "https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.woff2",
    );
  });

  it.each([
    ["?siteFont=Poppins", "Poppins"],
    ["?siteFont=Playfair%20Display", "Playfair Display"],
    ["?siteFont=a%22%3B%7D", null],
    ["", null],
  ])("siteFontFromSearch(%s) → %s", (search, expected) => {
    expect(siteFontFromSearch(search)).toBe(expected);
  });
});
