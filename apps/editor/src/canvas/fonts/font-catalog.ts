// ED-116: katalog font kurasi (subset Google Fonts populer yang tersedia di Fontsource). Dipakai picker font
// family di inspector; file font di-lazy-load dari CDN Fontsource saat preview/dipilih (lihat site-fonts.ts).
// Subset sengaja — bukan daftar penuh Google Fonts — demi bundle kecil & offline; bisa ditambah kapan saja.

export type FontCategory = "sans-serif" | "serif" | "monospace" | "display" | "handwriting";
// Fallback generik (FontDefSchema hanya mengizinkan tiga ini).
export type FontFallback = "sans-serif" | "serif" | "monospace";

export interface CatalogFont {
  family: string;
  category: FontCategory;
  fallback: FontFallback;
  // Weight yang di-load dari Fontsource (ED-224: hanya yang dipakai). 400 + 700 untuk reguler & tebal.
  weights: readonly number[];
}

const REGULAR_BOLD = [400, 700] as const;
const f = (
  family: string,
  category: FontCategory,
  fallback: FontFallback,
  weights: readonly number[] = REGULAR_BOLD,
): CatalogFont => ({ family, category, fallback, weights });

// Urutan = popularitas (ditampilkan apa adanya; search memfilter). Slug Fontsource = family huruf kecil, spasi→"-".
export const FONT_CATALOG: readonly CatalogFont[] = [
  f("Inter", "sans-serif", "sans-serif", [400, 500, 600, 700]),
  f("Roboto", "sans-serif", "sans-serif", [400, 500, 700]),
  f("Open Sans", "sans-serif", "sans-serif", [400, 600, 700]),
  f("Lato", "sans-serif", "sans-serif"),
  f("Montserrat", "sans-serif", "sans-serif", [400, 500, 600, 700]),
  f("Poppins", "sans-serif", "sans-serif", [400, 500, 600, 700]),
  f("Raleway", "sans-serif", "sans-serif"),
  f("Nunito", "sans-serif", "sans-serif"),
  f("Nunito Sans", "sans-serif", "sans-serif"),
  f("Work Sans", "sans-serif", "sans-serif"),
  f("Source Sans 3", "sans-serif", "sans-serif"),
  f("DM Sans", "sans-serif", "sans-serif", [400, 500, 700]),
  f("Plus Jakarta Sans", "sans-serif", "sans-serif", [400, 500, 600, 700]),
  f("Mulish", "sans-serif", "sans-serif"),
  f("Rubik", "sans-serif", "sans-serif"),
  f("Figtree", "sans-serif", "sans-serif"),
  f("Manrope", "sans-serif", "sans-serif"),
  f("Space Grotesk", "sans-serif", "sans-serif"),
  f("Noto Sans", "sans-serif", "sans-serif"),
  f("Oswald", "display", "sans-serif"),
  f("Bebas Neue", "display", "sans-serif", [400]),
  f("Merriweather", "serif", "serif"),
  f("Playfair Display", "serif", "serif", [400, 500, 600, 700]),
  f("Lora", "serif", "serif"),
  f("PT Serif", "serif", "serif"),
  f("Roboto Slab", "serif", "serif"),
  f("Noto Serif", "serif", "serif"),
  f("Source Serif 4", "serif", "serif"),
  f("JetBrains Mono", "monospace", "monospace"),
  f("Roboto Mono", "monospace", "monospace"),
  f("Fira Code", "monospace", "monospace"),
  f("IBM Plex Mono", "monospace", "monospace"),
  f("Space Mono", "monospace", "monospace"),
  f("Pacifico", "handwriting", "sans-serif", [400]),
  f("Caveat", "handwriting", "sans-serif"),
  f("Dancing Script", "handwriting", "sans-serif"),
];

/** Font katalog yang cocok dengan query (substring, case-insensitive); urutan popularitas dipertahankan. */
export function searchFonts(query: string, limit = 60): CatalogFont[] {
  const q = query.trim().toLowerCase();
  const matched = q === "" ? FONT_CATALOG : FONT_CATALOG.filter((font) => font.family.toLowerCase().includes(q));
  return matched.slice(0, limit);
}

export function catalogFont(family: string): CatalogFont | undefined {
  return FONT_CATALOG.find((font) => font.family.toLowerCase() === family.toLowerCase());
}

/** FontDef untuk command `addFont` (daftarkan ke theme). Subset katalog = sumber "google". */
export function catalogFontDef(font: CatalogFont): {
  family: string;
  source: "google";
  weights: number[];
  fallback: FontFallback;
} {
  return { family: font.family, source: "google", weights: [...font.weights], fallback: font.fallback };
}
