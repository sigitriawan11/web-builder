import { describe, expect, it } from "vitest";
import { checkPassword } from "./password-policy";
import { signUpConsents, signUpLocale } from "./sign-up";

describe("kebijakan password (ACC-001)", () => {
  it.each([
    ["password123", "too_common"],
    ["PASSWORD123", "too_common"],
    ["qwertyuiop", "too_common"],
    ["1234567", "too_short"],
    ["a".repeat(129), "too_long"],
    ["Kue-Lapis-2026!", null],
    ["a".repeat(128), null],
    ["rendang padang enak", null],
  ])("%s → %s", (password, problem) => {
    expect(checkPassword(password)).toBe(problem);
  });
});

describe("bahasa awal dari Accept-Language (ACC-001: id → id, selain itu en)", () => {
  it.each([
    ["id-ID,id;q=0.9", "id"],
    ["id", "id"],
    ["en-US,en;q=0.9,id;q=0.8", "en"],
    ["fr-FR,id;q=0.5", "id"],
    ["fr-FR", "en"],
    ["ide", "en"],
    [undefined, "en"],
  ])("%s → %s", (header, locale) => {
    expect(signUpLocale(header)).toBe(locale);
  });
});

it("consent registrasi: S&K & privasi granted, marketing sesuai pilihan", () => {
  const rows = signUpConsents("u1", { locale: "id", marketingOptIn: false, ip: "203.0.113.5" });
  expect(rows.map((row) => [row.type, row.granted, row.ip])).toEqual([
    ["terms", true, "203.0.113.5"],
    ["privacy", true, "203.0.113.5"],
    ["marketing", false, "203.0.113.5"],
  ]);
});
