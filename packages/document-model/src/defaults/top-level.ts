import type { BreakpointDef, SiteDocument, SiteSettings, Theme } from "../schema";

// Nilai awal field top-level dokumen baru (DM-004). Satu sumber untuk factory situs & fixture test.
// T1.8.12 mengganti `emptyTheme` dengan `defaultTheme` (DM-041).

// DM-035: default (nilai bisa diubah, breakpoint tidak bisa dihapus).
export const DEFAULT_BREAKPOINTS: readonly BreakpointDef[] = [
  { id: "base", label: { id: "Desktop", en: "Desktop" }, maxWidth: null, previewWidth: 1440 },
  { id: "tablet", label: { id: "Tablet", en: "Tablet" }, maxWidth: 991, previewWidth: 768 },
  { id: "mobile", label: { id: "Mobile", en: "Mobile" }, maxWidth: 479, previewWidth: 390 },
];

// DM-038: dipakai renderer bila `autoResponsive.mobileScale` tidak diisi.
export const DEFAULT_MOBILE_SCALE = { fontMin: 14, spacingFactor: 0.6 } as const;

export interface SettingsInput {
  // Judul situs (SEO default).
  title: string;
  // Bahasa website; default `id` (AC DM-005: mengikuti bahasa UI user saat membuat situs).
  language?: string;
}

export function defaultSiteSettings(input: SettingsInput): SiteSettings {
  return {
    language: input.language ?? "id",
    seo: { titleTemplate: `%s · ${input.title}`, defaultTitle: input.title },
    breakpoints: DEFAULT_BREAKPOINTS.map((breakpoint) => ({ ...breakpoint, label: { ...breakpoint.label } })),
    manualResponsive: false,
    autoResponsive: { enabled: true, rules: {} },
  };
}

export function emptyTheme(): Theme {
  return {
    tokens: { color: {}, typography: {}, fontFamily: {}, space: {}, radius: {}, shadow: {} },
    fonts: [],
  };
}

/** Field top-level selain meta/pageOrder/nodes untuk dokumen baru. */
export function emptyDocumentShell(
  input: SettingsInput,
): Pick<SiteDocument, "settings" | "theme" | "assets" | "componentDeps"> {
  return { settings: defaultSiteSettings(input), theme: emptyTheme(), assets: {}, componentDeps: {} };
}
