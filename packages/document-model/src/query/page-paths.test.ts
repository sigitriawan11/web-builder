import { describe, expect, it } from "vitest";
import { PagePropsSchema } from "../schema";
import { normalizePagePath, slugify, uniquePagePath, validatePagePath } from "./page-paths";

describe("slugify (ED-032)", () => {
  it.each([
    ["Tentang Kami", "tentang-kami"],
    ["  Layanan  Kami!! ", "layanan-kami"],
    ["Café Résumé", "cafe-resume"],
    ["Kue & Roti", "kue-dan-roti"],
    ["Produk 2026", "produk-2026"],
    ["日本語", ""],
    ["---", ""],
  ])("%j → %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("dibatasi 60 karakter tanpa tanda hubung di ujung", () => {
    const slug = slugify(`${"a".repeat(59)} b`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniquePagePath", () => {
  it("unik dengan sufiks; judul tanpa huruf → /page; hasil lolos schema path", () => {
    expect(uniquePagePath("Tentang", ["/", "/tentang"])).toBe("/tentang-2");
    expect(uniquePagePath("Tentang", ["/tentang", "/tentang-2"])).toBe("/tentang-3");
    expect(uniquePagePath("!!!", [])).toBe("/page");
    expect(uniquePagePath("Home", [])).toBe("/home");
    for (const title of ["Tentang Kami", "日本語", "Café"]) {
      expect(PagePropsSchema.shape.path.safeParse(uniquePagePath(title, [])).success).toBe(true);
    }
  });
});

describe("validatePagePath (ED-033, sama dengan command)", () => {
  const pages = [
    { id: "pg_home", path: "/" },
    { id: "pg_about", path: "/tentang" },
  ];
  it.each([
    ["/kontak", "pg_new", false, null],
    ["/layanan/web", "pg_new", false, null],
    ["/tentang", "pg_about", false, null],
    ["/tentang", "pg_new", false, "taken"],
    ["/", "pg_new", false, "rootIsHome"],
    ["/beranda", "pg_home", true, "homeIsRoot"],
    ["/", "pg_home", true, null],
    ["tentang", "pg_new", false, "format"],
    ["/Tentang", "pg_new", false, "format"],
    ["/tentang/", "pg_new", false, "format"],
    ["/a//b", "pg_new", false, "format"],
    ["/kopi_susu", "pg_new", false, "format"],
    [`/${"a".repeat(200)}`, "pg_new", false, "format"],
  ] as const)("%j (page %s, home %s) → %s", (path, id, isHome, expected) => {
    expect(validatePagePath(path, { id, isHome }, pages)).toBe(expected);
  });

  it("hasil normalisasi lolos validasi format", () => {
    expect(normalizePagePath("Tentang Kami")).toBe("/tentang-kami");
    expect(normalizePagePath("/Layanan/Web Design/")).toBe("/layanan/web-design");
    expect(normalizePagePath("  ")).toBe("/");
    expect(validatePagePath(normalizePagePath("Café Résumé"), { id: "x", isHome: false }, [])).toBeNull();
  });
});
