import { describe, expect, it } from "vitest";
import { minimalDocument } from "../../test/fixtures/basic-documents";
import { publishIssues } from "../../test/validation";
import { DEFAULT_BREAKPOINTS, defaultSiteSettings } from "../defaults/top-level";
import { SiteDocumentSchema } from "./document";
import { type SiteSettings, SiteSettingsSchema } from "./settings";

// T1.8.2: SiteSettings P0 (DM-005, DM-035, DM-037, DM-038).
const valid = (): SiteSettings => defaultSiteSettings({ title: "Toko Kue Budi" });
const parse = (patch: (settings: SiteSettings) => unknown) => SiteSettingsSchema.safeParse(patch(valid()));

describe("SiteSettings default", () => {
  it("valid: bahasa id, SEO dari judul, 3 breakpoint default, manualResponsive false, auto-responsive aktif", () => {
    const settings = valid();
    expect(SiteSettingsSchema.parse(settings)).toEqual(settings);
    expect(settings).toMatchObject({
      language: "id",
      seo: { titleTemplate: "%s · Toko Kue Budi", defaultTitle: "Toko Kue Budi" },
      manualResponsive: false,
      autoResponsive: { enabled: true, rules: {} },
    });
    expect(
      settings.breakpoints.map((breakpoint) => [breakpoint.id, breakpoint.maxWidth, breakpoint.previewWidth]),
    ).toEqual([
      ["base", null, 1440],
      ["tablet", 991, 768],
      ["mobile", 479, 390],
    ]);
  });

  it("default breakpoint tidak berbagi referensi antar dokumen", () => {
    const a = valid();
    a.breakpoints[1] = { ...a.breakpoints[1], maxWidth: 900 } as SiteSettings["breakpoints"][number];
    expect(DEFAULT_BREAKPOINTS[1]?.maxWidth).toBe(991);
    expect(valid().breakpoints[1]?.maxWidth).toBe(991);
  });
});

describe("SiteSettings validasi", () => {
  it.each([
    [
      "titleTemplate tanpa %s (AC DM-005)",
      (s: SiteSettings) => ({ ...s, seo: { ...s.seo, titleTemplate: "Toko Kue" } }),
    ],
    ["bahasa bukan BCP-47", (s: SiteSettings) => ({ ...s, language: "Indonesia" })],
    ["breakpoint kurang", (s: SiteSettings) => ({ ...s, breakpoints: s.breakpoints.slice(0, 2) })],
    [
      "breakpoint duplikat",
      (s: SiteSettings) => ({ ...s, breakpoints: [s.breakpoints[0], s.breakpoints[1], s.breakpoints[1]] }),
    ],
    [
      "maxWidth mobile ≥ tablet (AC DM-035)",
      (s: SiteSettings) => ({
        ...s,
        breakpoints: s.breakpoints.map((b) => (b.id === "mobile" ? { ...b, maxWidth: 991 } : b)),
      }),
    ],
    [
      "base punya maxWidth",
      (s: SiteSettings) => ({
        ...s,
        breakpoints: s.breakpoints.map((b) => (b.id === "base" ? { ...b, maxWidth: 2000 } : b)),
      }),
    ],
    [
      "breakpoint kustom (P2)",
      (s: SiteSettings) => ({
        ...s,
        breakpoints: s.breakpoints.map((b) => (b.id === "tablet" ? { ...b, id: "bp_wide" } : b)),
      }),
    ],
    [
      "aturan auto-responsive tak dikenal",
      (s: SiteSettings) => ({ ...s, autoResponsive: { ...s.autoResponsive, rules: { hideDecorative: false } } }),
    ],
    [
      "spacingFactor > 1",
      (s: SiteSettings) => ({
        ...s,
        autoResponsive: { ...s.autoResponsive, mobileScale: { fontMin: 14, spacingFactor: 1.5 } },
      }),
    ],
    ["customHead (sengaja tidak ada)", (s: SiteSettings) => ({ ...s, customHead: "<script>" })],
  ])("menolak %s", (_label, patch) => {
    expect(parse(patch).success).toBe(false);
  });

  it("aturan auto-responsive bisa dimatikan satu per satu; mobileScale opsional", () => {
    expect(
      parse((s) => ({
        ...s,
        autoResponsive: {
          enabled: true,
          rules: { stackRows: false },
          mobileScale: { fontMin: 16, spacingFactor: 0.5 },
        },
      })).success,
    ).toBe(true);
  });
});

describe("invariant aset settings (DM-069)", () => {
  it("favicon & ogImage harus merujuk aset yang terdaftar", () => {
    const doc = minimalDocument();
    const withRefs = {
      ...doc,
      settings: {
        ...doc.settings,
        favicon: { assetId: "ast_favicon001" },
        seo: { ...doc.settings.seo, ogImage: { assetId: "ast_og00000001" } },
      },
    };
    expect(publishIssues(withRefs)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^settings\.favicon\.assetId: /),
        expect.stringMatching(/^settings\.seo\.ogImage\.assetId: /),
      ]),
    );
    const registered = {
      ...withRefs,
      assets: {
        ast_favicon001: { kind: "image" as const, mime: "image/png" },
        ast_og00000001: { kind: "image" as const, mime: "image/jpeg" },
      },
    };
    expect(SiteDocumentSchema.safeParse(registered).success).toBe(true);
  });
});
