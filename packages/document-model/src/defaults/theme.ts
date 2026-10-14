import type { Theme } from "../schema";

// DM-041: set token default untuk website blank (dan cadangan `resolveValue` bila token hilang). Nama token
// mengikuti daftar DM-041 agar template, component library, dan AI bisa mengandalkannya.

const px = (value: number) => ({ value, unit: "px" as const });

// Skala spasi 4px.
const SPACE_STEPS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const;

export function defaultTheme(): Theme {
  return {
    tokens: {
      color: {
        primary: "#2563EB",
        primaryHover: "#1D4ED8",
        onPrimary: "#FFFFFF",
        background: "#FFFFFF",
        surface: "#F8FAFC",
        onSurface: "#0F172A",
        muted: "#64748B",
        border: "#E2E8F0",
        accent: "#F59E0B",
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
      },
      typography: {
        display: {
          value: { fontFamily: { $token: "fontFamily.heading" }, fontSize: px(64), fontWeight: 800, lineHeight: 1.1 },
          tablet: { fontFamily: { $token: "fontFamily.heading" }, fontSize: px(52), fontWeight: 800, lineHeight: 1.1 },
          mobile: { fontFamily: { $token: "fontFamily.heading" }, fontSize: px(40), fontWeight: 800, lineHeight: 1.15 },
        },
        h1: {
          value: { fontFamily: { $token: "fontFamily.heading" }, fontSize: px(48), fontWeight: 700, lineHeight: 1.15 },
          mobile: { fontFamily: { $token: "fontFamily.heading" }, fontSize: px(34), fontWeight: 700, lineHeight: 1.2 },
        },
        h2: {
          value: { fontFamily: { $token: "fontFamily.heading" }, fontSize: px(36), fontWeight: 700, lineHeight: 1.2 },
          mobile: { fontFamily: { $token: "fontFamily.heading" }, fontSize: px(28), fontWeight: 700, lineHeight: 1.25 },
        },
        h3: { fontFamily: { $token: "fontFamily.heading" }, fontSize: px(28), fontWeight: 600, lineHeight: 1.3 },
        h4: { fontFamily: { $token: "fontFamily.heading" }, fontSize: px(22), fontWeight: 600, lineHeight: 1.35 },
        body: { fontFamily: { $token: "fontFamily.body" }, fontSize: px(16), fontWeight: 400, lineHeight: 1.6 },
        bodySm: { fontFamily: { $token: "fontFamily.body" }, fontSize: px(14), fontWeight: 400, lineHeight: 1.55 },
        caption: { fontFamily: { $token: "fontFamily.body" }, fontSize: px(12), fontWeight: 400, lineHeight: 1.5 },
        button: { fontFamily: { $token: "fontFamily.body" }, fontSize: px(16), fontWeight: 600, lineHeight: 1.25 },
        overline: {
          fontFamily: { $token: "fontFamily.body" },
          fontSize: px(12),
          fontWeight: 600,
          lineHeight: 1.5,
          letterSpacing: { value: 0.08, unit: "em" },
          textTransform: "uppercase",
        },
      },
      fontFamily: { heading: "Plus Jakarta Sans", body: "Inter", mono: "JetBrains Mono" },
      space: Object.fromEntries(SPACE_STEPS.map((step) => [String(step), px(step * 4)])),
      radius: { none: px(0), sm: px(4), md: px(8), lg: px(12), xl: px(16), full: px(9999) },
      shadow: {
        sm: [{ type: "dropShadow", x: 0, y: 1, blur: 2, color: "#0F172A14" }],
        md: [{ type: "dropShadow", x: 0, y: 4, blur: 16, color: "#0F172A1A" }],
        lg: [{ type: "dropShadow", x: 0, y: 12, blur: 32, spread: -4, color: "#0F172A26" }],
      },
      size: { container: px(1200), contentNarrow: px(720) },
    },
    fonts: [
      { family: "Plus Jakarta Sans", source: "google", weights: [600, 700, 800], fallback: "sans-serif" },
      { family: "Inter", source: "google", weights: [400, 600], fallback: "sans-serif" },
      { family: "JetBrains Mono", source: "google", weights: [400], fallback: "monospace" },
    ],
  };
}
