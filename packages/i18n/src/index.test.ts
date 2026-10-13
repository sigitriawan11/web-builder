import { describe, expect, it } from "vitest";
import { hasMessage, LOCALES, localeFromAcceptLanguage, t } from "./index";
import enErrors from "./locales/en/errors.json" with { type: "json" };
import idErrors from "./locales/id/errors.json" with { type: "json" };

describe("i18n dasar (ACC-290)", () => {
  it("ID & EN punya key error yang sama persis", () => {
    expect(Object.keys(enErrors).sort()).toEqual(Object.keys(idErrors).sort());
    for (const locale of LOCALES) expect(hasMessage(locale, "errors", "NOT_FOUND")).toBe(true);
  });

  it("t(): bahasa diminta → default id → key", () => {
    expect(t("en", "errors", "NOT_FOUND")).toBe("The requested data was not found.");
    expect(t("id", "errors", "NOT_FOUND")).toBe("Data yang dicari tidak ditemukan.");
    expect(t("en", "errors", "KODE_TIDAK_ADA")).toBe("KODE_TIDAK_ADA");
  });

  it.each([
    [undefined, "id"],
    ["", "id"],
    ["en-US,en;q=0.9", "en"],
    ["id-ID,id;q=0.9,en;q=0.8", "id"],
    ["fr-FR,fr;q=0.9,en;q=0.5", "en"],
    ["en;q=0.4,id;q=0.6", "id"],
    ["de, ja", "id"],
    ["en;q=0", "id"],
  ])("Accept-Language %j → %s", (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });
});
