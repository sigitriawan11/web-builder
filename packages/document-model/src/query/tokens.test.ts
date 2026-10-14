import { describe, expect, it } from "vitest";
import { minimalDocument } from "../../test/fixtures/basic-documents";
import { createBlankSiteDocument } from "../defaults/blank-site";
import { defaultTheme } from "../defaults/theme";
import { emptyTheme } from "../defaults/top-level";
import { SiteDocumentSchema, type Theme, ThemeSchema } from "../schema";
import { resolveStyle } from "./resolve-style";
import {
  listTokenPaths,
  MAX_ALIAS_DEPTH,
  resolveToken,
  resolveValue,
  TokenCycleError,
  TokenNotFoundError,
  TokenResolveError,
} from "./tokens";

// T1.8.12: theme & token (DM-041, DM-042) + resolveValue (AC DM-025).
const px = (value: number) => ({ value, unit: "px" as const });

function theme(colors: Theme["tokens"]["color"], extra: Partial<Theme["tokens"]> = {}): Theme {
  const base = emptyTheme();
  return { ...base, tokens: { ...base.tokens, color: colors, ...extra } };
}

const issues = (t: Theme) => {
  const doc = { ...minimalDocument(), theme: t };
  return (SiteDocumentSchema.safeParse(doc).error?.issues ?? []).map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("resolveToken", () => {
  const t = theme(
    { brand: { 600: "#9A3412" }, primary: { $token: "color.brand.600" }, primaryHover: { $token: "color.primary" } },
    {
      space: { 4: px(16), gutter: { value: px(32), tablet: px(24), mobile: px(16) } },
      typography: { h1: { fontSize: px(48) } },
    },
  );

  it("literal, alias berantai, grup bersarang, alias pendek `type`", () => {
    expect(resolveToken(t, "color.brand.600")).toBe("#9A3412");
    expect(resolveToken(t, "color.primaryHover")).toBe("#9A3412");
    expect(resolveToken(t, "space.4")).toEqual(px(16));
    expect(resolveToken(t, "type.h1")).toEqual({ fontSize: px(48) });
  });

  it("token responsif memilih varian breakpoint (mobile mewarisi tablet)", () => {
    expect(resolveToken(t, "space.gutter")).toEqual(px(32));
    expect(resolveToken(t, "space.gutter", { breakpoint: "tablet" })).toEqual(px(24));
    expect(resolveToken(t, "space.gutter", { breakpoint: "mobile" })).toEqual(px(16));
    const tabletOnly = theme({}, { space: { g: { value: px(32), tablet: px(24) } } });
    expect(resolveToken(tabletOnly, "space.g", { breakpoint: "mobile" })).toEqual(px(24));
  });

  it("varian dark dipakai hanya di mode dark", () => {
    const dark = theme({ bg: { value: "#FFFFFF", dark: "#000000" } });
    expect(resolveToken(dark, "color.bg")).toBe("#FFFFFF");
    expect(resolveToken(dark, "color.bg", { mode: "dark" })).toBe("#000000");
  });

  it("path hilang → TokenNotFoundError (termasuk grup bersarang & field di dalam literal)", () => {
    for (const path of ["color.nope", "color.brand", "type.h1.fontSize", "shadow.md", "unknown.x"]) {
      expect(() => resolveToken(t, path), path).toThrow(TokenNotFoundError);
    }
    const broken = theme({ primary: { $token: "color.missing" } });
    try {
      resolveToken(broken, "color.primary");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(TokenNotFoundError);
      expect(error).toMatchObject({ code: "TOKEN_NOT_FOUND", path: "color.missing", chain: ["color.primary"] });
    }
  });

  it("siklus → TokenCycleError (langsung & tidak langsung)", () => {
    const cyclic = theme({
      a: { $token: "color.b" },
      b: { $token: "color.c" },
      c: { $token: "color.a" },
      self: { $token: "color.self" },
    });
    expect(() => resolveToken(cyclic, "color.a")).toThrow(TokenCycleError);
    expect(() => resolveToken(cyclic, "color.self")).toThrow(/siklus: color\.self → color\.self/);
  });

  it(`alias lebih dari ${MAX_ALIAS_DEPTH} langkah & lintas grup ditolak`, () => {
    const chain: Theme["tokens"]["color"] = { c0: "#000000" };
    for (let i = 1; i <= MAX_ALIAS_DEPTH + 1; i++) chain[`c${i}`] = { $token: `color.c${i - 1}` };
    expect(resolveToken(theme(chain), `color.c${MAX_ALIAS_DEPTH}`)).toBe("#000000");
    expect(() => resolveToken(theme(chain), `color.c${MAX_ALIAS_DEPTH + 1}`)).toThrow(
      expect.objectContaining({ code: "TOKEN_DEPTH" }),
    );
    const cross = theme({ primary: { $token: "space.4" } }, { space: { 4: px(16) } });
    expect(() => resolveToken(cross, "color.primary")).toThrow(
      expect.objectContaining({ code: "TOKEN_GROUP_MISMATCH" }),
    );
  });
});

describe("validasi theme di dokumen (DM-041/DM-042)", () => {
  it("siklus, alias hilang, lintas grup → issue di path token", () => {
    const result = issues(
      theme(
        { a: { $token: "color.b" }, b: { $token: "color.a" }, c: { $token: "color.zzz" }, d: { $token: "radius.md" } },
        { radius: { md: px(8) } },
      ),
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^theme\.tokens\.color\.a: .*siklus/),
        expect.stringMatching(/^theme\.tokens\.color\.c: Token "color\.zzz" tidak ada/),
        expect.stringMatching(/^theme\.tokens\.color\.d: .*beda grup/),
      ]),
    );
  });

  it("typography merujuk grup yang cocok; fontFamily wajib terdaftar di fonts", () => {
    const t = theme(
      { primary: "#000000" },
      {
        fontFamily: { body: "Inter" },
        typography: { body: { fontFamily: { $token: "color.primary" }, fontSize: { $token: "space.nope" } } },
      },
    );
    expect(issues(t)).toEqual(
      expect.arrayContaining([
        'theme.tokens.fontFamily.body: Font "Inter" tidak terdaftar di theme.fonts',
        'theme.tokens.typography.body.fontFamily: Token "color.primary" harus dari grup fontFamily',
        'theme.tokens.typography.body.fontSize: Token "space.nope" tidak ada di theme',
      ]),
    );
  });

  it("bentuk literal per grup ditegakkan", () => {
    for (const tokens of [
      { color: { primary: "red" } },
      { space: { 4: 16 } },
      { typography: { h1: { fontSize: px(48), color: "#000000" } } },
      { shadow: { sm: [{ x: 0, y: 1, blur: 2, color: "#000000" }] } },
      { color: { primary: { value: "#000000", unknown: 1 } } },
    ]) {
      const t = { ...emptyTheme(), tokens: { ...emptyTheme().tokens, ...tokens } };
      expect(ThemeSchema.safeParse(t).success, JSON.stringify(tokens)).toBe(false);
    }
  });
});

describe("defaultTheme (AC DM-041)", () => {
  it("valid, semua token ter-resolve, berisi nama token standar", () => {
    const t = defaultTheme();
    expect(issues(t)).toEqual([]);
    const paths = listTokenPaths(t);
    for (const path of [
      "color.primary",
      "color.onSurface",
      "type.h1",
      "typography.overline",
      "fontFamily.mono",
      "space.24",
      "radius.full",
      "shadow.lg",
      "size.container",
    ]) {
      expect(() => resolveToken(t, path), path).not.toThrow();
    }
    expect(paths).toHaveLength(12 + 10 + 3 + 13 + 6 + 3 + 2);
  });

  it("dipakai website blank", () => {
    expect(createBlankSiteDocument({ title: "Toko" }).theme).toEqual(defaultTheme());
  });
});

describe("resolveValue (AC DM-025)", () => {
  const t = theme({ primary: "#2563EB", ink: "#11223380" });

  it("literal apa adanya; token → literal; alpha diterapkan ke hex", () => {
    expect(resolveValue(px(4), { theme: t })).toEqual(px(4));
    expect(resolveValue({ $token: "color.primary" }, { theme: t })).toBe("#2563EB");
    expect(resolveValue({ $token: "color.primary", alpha: 0.5 }, { theme: t })).toBe("#2563EB80");
    expect(resolveValue({ $token: "color.ink", alpha: 0.5 }, { theme: t })).toBe("#11223340");
  });

  it("token hilang → fallback theme default + warning, tanpa crash", () => {
    const warnings: string[] = [];
    const ctx = { theme: t, fallbackTheme: defaultTheme(), onWarning: (w: { code: string }) => warnings.push(w.code) };
    expect(resolveValue({ $token: "color.danger" }, ctx)).toBe("#DC2626");
    expect(resolveValue({ $token: "color.tidakAda" }, ctx)).toBeUndefined();
    expect(warnings).toEqual(["TOKEN_NOT_FOUND", "TOKEN_NOT_FOUND"]);
    const cyclic = theme({ a: { $token: "color.a" } });
    expect(resolveValue({ $token: "color.a" }, { theme: cyclic })).toBeUndefined();
  });

  it("$prop: nilai prop, lalu fallback; token di dalam prop ikut di-resolve", () => {
    expect(resolveValue({ $prop: "bg" }, { theme: t, props: { bg: { $token: "color.primary" } } })).toBe("#2563EB");
    expect(resolveValue({ $prop: "bg", fallback: "#000000" }, { theme: t, props: {} })).toBe("#000000");
  });

  it("error bertipe turunan TokenResolveError", () => {
    expect(new TokenNotFoundError("x.y", [])).toBeInstanceOf(TokenResolveError);
  });
});

describe("resolveStyle + token typography komposit (DM-032/DM-036)", () => {
  it("patch field di atas token di-merge setelah token di-expand (varian breakpoint)", () => {
    const style = {
      base: { typography: { $token: "type.h1" } },
      mobile: { typography: { fontWeight: 400 } },
    };
    const t = defaultTheme();
    expect(resolveStyle(style, "mobile", { theme: t }).typography).toEqual({
      fontFamily: { $token: "fontFamily.heading" },
      fontSize: px(34),
      fontWeight: 400,
      lineHeight: 1.2,
    });
    // Tanpa theme: perilaku lama (patch mengganti utuh).
    expect(resolveStyle(style, "mobile").typography).toEqual({ fontWeight: 400 });
  });
});
