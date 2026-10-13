import { describe, expect, it } from "vitest";
import { hasMessage, LOCALES, localeFromAcceptLanguage, t } from "./index";
import enEmails from "./locales/en/emails.json" with { type: "json" };
import enErrors from "./locales/en/errors.json" with { type: "json" };
import idEmails from "./locales/id/emails.json" with { type: "json" };
import idErrors from "./locales/id/errors.json" with { type: "json" };

describe("i18n dasar (ACC-290)", () => {
  it("ID & EN punya key error yang sama persis", () => {
    expect(Object.keys(enErrors).sort()).toEqual(Object.keys(idErrors).sort());
    for (const locale of LOCALES) expect(hasMessage(locale, "errors", "NOT_FOUND")).toBe(true);
  });

  it("ID & EN punya key email yang sama persis", () => {
    expect(Object.keys(enEmails).sort()).toEqual(Object.keys(idEmails).sort());
  });

  it("t(): placeholder {nama} diganti; yang tidak diberi nilai dibiarkan", () => {
    expect(t("id", "emails", "account_exists.greeting", { name: "Budi" })).toBe("Halo Budi,");
    expect(t("en", "emails", "account_exists.greeting")).toBe("Hi {name},");
    expect(t("en", "emails", "account_exists.greeting", { other: 1 })).toBe("Hi {name},");
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
