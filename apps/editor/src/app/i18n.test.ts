import { describe, expect, it } from "vitest";
import { initialLocale } from "./i18n";

describe("initialLocale", () => {
  it("cookie NEXT_LOCALE → bahasa browser → id", () => {
    expect(initialLocale("theme=dark; NEXT_LOCALE=en", ["id-ID"])).toBe("en");
    expect(initialLocale("NEXT_LOCALE=fr", ["en-US", "en"])).toBe("en");
    expect(initialLocale("", ["de-DE"])).toBe("id");
  });
});
