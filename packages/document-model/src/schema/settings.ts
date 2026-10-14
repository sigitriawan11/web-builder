import { z } from "zod";
import { AssetRefSchema } from "./nodes";

// `SiteSettings` (DM-005) field P0. P2 (`alternateLanguages` ❓ OPEN-DM-1, `defaultPageTransition`) ditambah bersama
// fiturnya; `customHead` SENGAJA tidak ada (keamanan).

// DM-035: breakpoint tetap M1 (custom `bp_*` = P2/M9). Desktop-first: `base` tanpa media query.
export const BREAKPOINT_IDS = ["base", "tablet", "mobile"] as const;
export const BreakpointIdSchema = z.enum(BREAKPOINT_IDS);

export const BreakpointDefSchema = z.strictObject({
  id: BreakpointIdSchema,
  label: z.strictObject({ id: z.string().min(1).max(40), en: z.string().min(1).max(40) }),
  // `null` hanya untuk base.
  maxWidth: z.number().int().positive().max(10_000).nullable(),
  // Lebar artboard default di editor.
  previewWidth: z.number().int().min(240).max(10_000),
});

// DM-038: aturan auto-responsive yang bisa dimatikan per aturan (`hideDecorative` sengaja tidak ada).
export const AUTO_RULE_IDS = [
  "stackRows",
  "wrapRowsTablet",
  "gridColumns",
  "fixedToFluid",
  "absoluteToFlow",
  "scaleSpacing",
  "scaleType",
] as const;
export const AutoRuleIdSchema = z.enum(AUTO_RULE_IDS);

export const AutoResponsiveConfigSchema = z.strictObject({
  enabled: z.boolean(),
  // Aturan yang tidak disebut = aktif.
  rules: z.partialRecord(AutoRuleIdSchema, z.boolean()),
  mobileScale: z
    .strictObject({
      fontMin: z.number().min(8).max(64),
      spacingFactor: z.number().gt(0).max(1),
    })
    .optional(),
});

export const SiteSeoSchema = z.strictObject({
  // Wajib mengandung `%s` (diganti judul halaman) — AC DM-005.
  titleTemplate: z
    .string()
    .min(2)
    .max(120)
    .refine((value) => value.includes("%s"), "titleTemplate wajib mengandung %s"),
  defaultTitle: z.string().min(1).max(120),
  // ≤ 160 karakter disarankan (UI memperingatkan); batas keras lebih longgar.
  defaultDescription: z.string().max(320).optional(),
  ogImage: AssetRefSchema.optional(),
  noIndex: z.boolean().optional(),
});

// BCP-47 (sederhana): bahasa 2–3 huruf + subtag opsional, mis. `id`, `en`, `en-US`, `zh-Hant`.
export const LanguageTagSchema = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "bukan tag bahasa BCP-47");

export const SiteSettingsSchema = z
  .strictObject({
    language: LanguageTagSchema,
    seo: SiteSeoSchema,
    favicon: AssetRefSchema.optional(),
    breakpoints: z.array(BreakpointDefSchema).length(BREAKPOINT_IDS.length),
    manualResponsive: z.boolean(),
    autoResponsive: AutoResponsiveConfigSchema,
  })
  .superRefine((settings, ctx) => {
    const byId = new Map(settings.breakpoints.map((breakpoint) => [breakpoint.id, breakpoint]));
    if (byId.size !== settings.breakpoints.length) {
      ctx.addIssue({ code: "custom", path: ["breakpoints"], message: "id breakpoint duplikat" });
      return;
    }
    const base = byId.get("base");
    const tablet = byId.get("tablet");
    const mobile = byId.get("mobile");
    if (!base || !tablet || !mobile) {
      ctx.addIssue({ code: "custom", path: ["breakpoints"], message: "breakpoint base, tablet, mobile wajib ada" });
      return;
    }
    const at = (id: string) => [
      "breakpoints",
      settings.breakpoints.findIndex((breakpoint) => breakpoint.id === id),
      "maxWidth",
    ];
    if (base.maxWidth !== null)
      ctx.addIssue({ code: "custom", path: at("base"), message: "base tidak punya maxWidth" });
    if (tablet.maxWidth === null)
      ctx.addIssue({ code: "custom", path: at("tablet"), message: "tablet wajib punya maxWidth" });
    if (mobile.maxWidth === null)
      ctx.addIssue({ code: "custom", path: at("mobile"), message: "mobile wajib punya maxWidth" });
    // DM-035: maxWidth mobile < tablet.
    if (tablet.maxWidth !== null && mobile.maxWidth !== null && mobile.maxWidth >= tablet.maxWidth) {
      ctx.addIssue({ code: "custom", path: at("mobile"), message: "maxWidth mobile harus lebih kecil dari tablet" });
    }
  });

export type BreakpointId = z.infer<typeof BreakpointIdSchema>;
export type BreakpointDef = z.infer<typeof BreakpointDefSchema>;
export type AutoRuleId = z.infer<typeof AutoRuleIdSchema>;
export type AutoResponsiveConfig = z.infer<typeof AutoResponsiveConfigSchema>;
export type SiteSeo = z.infer<typeof SiteSeoSchema>;
export type SiteSettings = z.infer<typeof SiteSettingsSchema>;
