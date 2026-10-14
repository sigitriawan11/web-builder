import type { SiteDocument, SiteSettings, Theme } from "../schema";

// Nilai awal field top-level dokumen baru (DM-004). Satu sumber untuk factory situs & fixture test.
// T1.8.2 mengisi settings default (DM-005), T1.8.12 menggantinya dengan `defaultTheme` (DM-041).

export function emptySiteSettings(): SiteSettings {
  return {};
}

export function emptyTheme(): Theme {
  return {
    tokens: { color: {}, typography: {}, fontFamily: {}, space: {}, radius: {}, shadow: {} },
    fonts: [],
  };
}

/** Field top-level selain meta/pageOrder/nodes untuk dokumen baru. */
export function emptyDocumentShell(): Pick<SiteDocument, "settings" | "theme" | "assets" | "componentDeps"> {
  return { settings: emptySiteSettings(), theme: emptyTheme(), assets: {}, componentDeps: {} };
}
