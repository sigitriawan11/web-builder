import { describe, expect, it } from "vitest";
import {
  checkMessages,
  getMessages,
  hasMessage,
  LOCALES,
  localeFromAcceptLanguage,
  NAMESPACES,
  t,
  translate,
} from "./index";
import { MESSAGES } from "./messages";

describe("katalog (ACC-290)", () => {
  it("katalog nyata: id & en lengkap, ICU valid, placeholder konsisten (`pnpm i18n:check`)", () => {
    expect(checkMessages(MESSAGES)).toEqual([]);
  });

  it("semua namespace spec ada di setiap bahasa", () => {
    expect(NAMESPACES.sort()).toEqual([
      "admin",
      "auth",
      "billing",
      "common",
      "dashboard",
      "editor",
      "emails",
      "errors",
    ]);
    for (const locale of LOCALES) expect(Object.keys(getMessages(locale)).sort()).toEqual(NAMESPACES.sort());
  });

  it("key EN hilang → terdeteksi (AC T1.15.1)", () => {
    const issues = checkMessages({
      id: { auth: { login: { title: "Masuk", submit: "Kirim" } } },
      en: { auth: { login: { title: "Sign in" } } },
    });
    expect(issues).toEqual([{ kind: "missing", namespace: "auth", key: "login.submit", locale: "en" }]);
  });

  it("key hanya ada di EN, placeholder berbeda, ICU rusak, dan nilai bukan string → terdeteksi", () => {
    const issues = checkMessages({
      id: { common: { greet: "Halo {name}", count: "{n, plural, other {# situs}}", broken: "Halo", nested: "x" } },
      en: {
        common: {
          greet: "Hi {nama}",
          count: "{n, plural, one {# site} other {# sites}}",
          broken: "Hi {",
          extra: "Only EN",
          nested: { a: 1 },
        },
      },
    });
    expect(issues.map((issue) => [issue.kind, issue.key, issue.locale])).toEqual(
      expect.arrayContaining([
        ["placeholder_mismatch", "greet", "en"],
        ["invalid_icu", "broken", "en"],
        ["missing", "extra", "id"],
        ["missing", "nested", "en"],
        ["missing", "nested.a", "id"],
      ]),
    );
    // Plural dengan kategori berbeda tetap konsisten selama argumennya sama.
    expect(issues.some((issue) => issue.key === "count")).toBe(false);
  });
});

describe("t() & translate()", () => {
  it("ICU: argumen, plural & select; key bersarang", () => {
    expect(t("id", "emails", "auth.account_exists.greeting", { name: "Budi" })).toBe("Halo Budi,");
    expect(t("en", "emails", "auth.account_exists.greeting", { name: "Budi" })).toBe("Hi Budi,");
  });

  it("nilai placeholder tidak diberikan → teks mentah (tidak melempar)", () => {
    expect(t("en", "emails", "auth.account_exists.greeting")).toBe("Hi {name},");
  });

  it("bahasa diminta → default id → key; translate untuk key runtime", () => {
    expect(t("en", "errors", "NOT_FOUND")).toBe("The requested data was not found.");
    expect(t("id", "errors", "NOT_FOUND")).toBe("Data yang dicari tidak ditemukan.");
    expect(translate("en", "errors", "KODE_TIDAK_ADA")).toBe("KODE_TIDAK_ADA");
    expect(hasMessage("en", "errors", "NOT_FOUND")).toBe(true);
    expect(hasMessage("en", "errors", "KODE_TIDAK_ADA")).toBe(false);
    expect(hasMessage("en", "emails", "auth.welcome")).toBe(false);
  });
});

describe("localeFromAcceptLanguage", () => {
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
