import type { CSSProperties } from "react";

// DM-041: node merujuk token lewat CSS variable (`color.primary` → `var(--color-primary)`),
// sehingga ganti tema tidak perlu render ulang node.
export function tokenVar(path: string): string {
  return `var(--${path.replaceAll(".", "-")})`;
}

// SEMENTARA (spike M0): nilai token default sampai theme dokumen ada (T1.8.12).
const PROTOTYPE_TOKENS: Record<string, string> = {
  "color.background": "#FFFFFF",
  "color.surface": "#FFF8F0",
  "color.primary": "#E85D2A",
  "color.onPrimary": "#FFFFFF",
  "color.onSurface": "#1F1A17",
  "color.muted": "#6B625C",
  "color.border": "#E5DED6",
  "color.brand.600": "#C2410C",
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map((step) => [`space.${step}`, `${step * 4}px`])),
  "radius.none": "0px",
  "radius.sm": "4px",
  "radius.md": "8px",
  "radius.lg": "16px",
  "radius.xl": "24px",
  "radius.full": "9999px",
  "size.container": "1200px",
  "size.content-narrow": "720px",
};

// Custom property CSS untuk dipasang di elemen pembungkus canvas.
export const PROTOTYPE_TOKEN_STYLE = Object.fromEntries(
  Object.entries(PROTOTYPE_TOKENS).map(([path, value]) => [`--${path.replaceAll(".", "-")}`, value]),
) as CSSProperties;
