import { defaultTheme, type Theme, ThemeSchema } from "@platform/document-model";
import { z } from "zod";

// CMP-120/CMP-124 (T3.11.1): preset theme awal untuk dogfooding (6; 16 di M4). Tiap preset = token desain (warna +
// pasangan font) di atas skala tipografi/spasi/radius/shadow default. Font HARUS dari daftar berlisensi (CMP-191,
// `data/fonts.json`). Kontras teks utama wajib lulus WCAG AA (diuji `themes.test.ts`).

const SlugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug kebab-case");

export const SeedThemeSchema = z.strictObject({
  slug: SlugSchema,
  displayName: z.strictObject({ id: z.string().min(1).max(60), en: z.string().min(1).max(60) }),
  mode: z.enum(["light", "dark"]),
  tags: z.array(SlugSchema).max(10),
  industries: z.array(SlugSchema).max(10),
  sortOrder: z.number().int().nonnegative(),
  theme: ThemeSchema,
});
export type SeedTheme = z.infer<typeof SeedThemeSchema>;

// Pasangan font (dari daftar berlisensi) + fallback.
interface Fonts {
  heading: { family: string; weights: number[]; fallback: "sans-serif" | "serif" };
  body: { family: string; weights: number[]; fallback: "sans-serif" | "serif" };
}
const MONO = { family: "JetBrains Mono", weights: [400], fallback: "monospace" as const };

// Warna dasar dipakai semua preset (teks/latar netral, status). Preset hanya mengganti primary/hover/accent + font.
const BASE_COLORS = {
  onPrimary: "#FFFFFF",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  onSurface: "#0F172A",
  muted: "#475569",
  border: "#E2E8F0",
  success: "#15803D",
  warning: "#B45309",
  danger: "#B91C1C",
};

function preset(
  slug: string,
  displayName: { id: string; en: string },
  sortOrder: number,
  colors: { primary: string; primaryHover: string; accent: string },
  fonts: Fonts,
  tags: string[] = [],
  industries: string[] = [],
): SeedTheme {
  const base = defaultTheme();
  const theme: Theme = {
    ...base,
    tokens: {
      ...base.tokens,
      color: { ...BASE_COLORS, primary: colors.primary, primaryHover: colors.primaryHover, accent: colors.accent },
      fontFamily: { heading: fonts.heading.family, body: fonts.body.family, mono: MONO.family },
    },
    fonts: [
      {
        family: fonts.heading.family,
        source: "fontsource",
        weights: fonts.heading.weights,
        fallback: fonts.heading.fallback,
      },
      { family: fonts.body.family, source: "fontsource", weights: fonts.body.weights, fallback: fonts.body.fallback },
      { family: MONO.family, source: "fontsource", weights: MONO.weights, fallback: MONO.fallback },
    ],
  };
  return { slug, displayName, mode: "light", tags, industries, sortOrder, theme: ThemeSchema.parse(theme) };
}

const SANS = (family: string, weights: number[]) => ({ family, weights, fallback: "sans-serif" as const });
const SERIF = (family: string, weights: number[]) => ({ family, weights, fallback: "serif" as const });

export const THEME_PRESETS: SeedTheme[] = [
  preset(
    "modern-blue",
    { id: "Biru Modern", en: "Modern Blue" },
    0,
    { primary: "#2563EB", primaryHover: "#1D4ED8", accent: "#F59E0B" },
    { heading: SANS("Poppins", [500, 600, 700]), body: SANS("Inter", [400, 500, 600]) },
    ["clean", "tech", "saas"],
    ["teknologi", "jasa"],
  ),
  preset(
    "emerald-fresh",
    { id: "Emerald Segar", en: "Emerald Fresh" },
    1,
    { primary: "#047857", primaryHover: "#065F46", accent: "#F59E0B" },
    { heading: SANS("Montserrat", [600, 700]), body: SANS("Open Sans", [400, 600]) },
    ["fresh", "organic"],
    ["kuliner", "kesehatan"],
  ),
  preset(
    "sunset-warm",
    { id: "Sunset Hangat", en: "Sunset Warm" },
    2,
    { primary: "#C2410C", primaryHover: "#9A3412", accent: "#0EA5E9" },
    { heading: SANS("Poppins", [500, 600, 700]), body: SANS("Nunito", [400, 600, 700]) },
    ["warm", "friendly"],
    ["kuliner", "ritel"],
  ),
  preset(
    "elegant-serif",
    { id: "Serif Elegan", en: "Elegant Serif" },
    3,
    { primary: "#6D28D9", primaryHover: "#5B21B6", accent: "#DB2777" },
    { heading: SERIF("Playfair Display", [600, 700]), body: SANS("Lato", [400, 700]) },
    ["elegant", "editorial"],
    ["fashion", "jasa"],
  ),
  preset(
    "classic-corporate",
    { id: "Korporat Klasik", en: "Classic Corporate" },
    4,
    { primary: "#1E40AF", primaryHover: "#1E3A8A", accent: "#0D9488" },
    { heading: SANS("Work Sans", [500, 600, 700]), body: SANS("Roboto", [400, 500, 700]) },
    ["corporate", "trust"],
    ["keuangan", "jasa"],
  ),
  preset(
    "rose-boutique",
    { id: "Rose Butik", en: "Rose Boutique" },
    5,
    { primary: "#BE123C", primaryHover: "#9F1239", accent: "#7C3AED" },
    { heading: SANS("Montserrat", [600, 700]), body: SANS("Source Sans 3", [400, 600]) },
    ["boutique", "chic"],
    ["fashion", "kecantikan"],
  ),
];
