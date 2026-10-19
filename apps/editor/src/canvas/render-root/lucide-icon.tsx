import { icons } from "lucide-react";
import { createElement, type ReactNode } from "react";
import { BrandIcon } from "./BrandIcon";

// DM-015: nama ikon dokumen = kebab-case (`air-vent`); lucide-react memetakan PascalCase (`AirVent`).
export function kebabToPascal(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function pascalToKebab(name: string): string {
  // Dua tahap agar akronim/huruf kapital beruntun terpisah benar (AArrowDown → a-arrow-down).
  return name
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

// Hanya nama yang round-trip (kebab → pascal → kebab) agar picker tidak menawarkan ikon yang gagal render
// (≈ 4 ikon sortir A↔Z dengan akronim di akhir).
const ICON_NAMES: readonly string[] = Object.keys(icons)
  .map(pascalToKebab)
  .filter((name) => kebabToPascal(name) in icons);

/** Semua nama ikon Lucide (kebab-case) yang cocok dengan query; dibatasi `limit`. */
export function searchIcons(query: string, limit = 60): string[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, "-");
  const matched = q === "" ? ICON_NAMES : ICON_NAMES.filter((name) => name.includes(q));
  return matched.slice(0, limit);
}

export const isIconName = (name: string): boolean => kebabToPascal(name) in icons;

/** Elemen SVG ikon Lucide (editor); `ctx.icon` renderer. Warna currentColor, ukuran 100% mengikuti elemen node. */
export function renderLucideIcon(name: string, strokeWidth?: number): ReactNode {
  const Icon = (icons as Record<string, React.ComponentType<{ width: string; height: string; strokeWidth?: number }>>)[
    kebabToPascal(name)
  ];
  if (!Icon) return null;
  return createElement(Icon, { width: "100%", height: "100%", ...(strokeWidth ? { strokeWidth } : {}) });
}

/** Resolver ikon editor (`ctx.icon`): set `brand` → logo Simple Icons (lazy); selain itu Lucide (DM-015/ED-163). */
export function renderIcon(name: string, strokeWidth?: number, set?: "lucide" | "brand"): ReactNode {
  if (set === "brand") return createElement(BrandIcon, { slug: name });
  return renderLucideIcon(name, strokeWidth);
}
