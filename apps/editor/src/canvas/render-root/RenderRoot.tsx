import type { Breakpoint, Theme } from "@platform/document-model";
import { BASE_FONT_FAMILY, tokenDeclarations } from "@platform/renderer";
import { type CSSProperties, type ReactNode, useMemo } from "react";
import { declarationsToStyle } from "./editor-style";

/** Variabel token theme (PUB-043) untuk frame breakpoint: base lalu override tablet/mobile (desktop-first). */
export function tokenScopeStyle(theme: Theme | null, breakpoint: Breakpoint): CSSProperties {
  if (!theme) return {};
  const tokens = tokenDeclarations(theme);
  const cascade =
    breakpoint === "base"
      ? tokens.base
      : breakpoint === "tablet"
        ? [...tokens.base, ...tokens.tablet]
        : [...tokens.base, ...tokens.tablet, ...tokens.mobile];
  return declarationsToStyle(cascade);
}

interface RenderScopeProps {
  children: ReactNode;
  theme: Theme | null;
  breakpoint: Breakpoint;
  className?: string | undefined;
  // Stack font-family teks situs (`?font=`, T0.4.7); default = font dasar renderer (token fontFamily.body, sama dengan
  // publish).
  fontStack?: string | undefined;
}

// Pembungkus canvas: menyediakan CSS variable token & font dasar teks situs (DM-041).
export function RenderScope({ children, theme, breakpoint, className, fontStack }: RenderScopeProps) {
  const style = useMemo(
    () => ({ ...tokenScopeStyle(theme, breakpoint), fontFamily: fontStack ?? BASE_FONT_FAMILY }),
    [theme, breakpoint, fontStack],
  );
  return (
    <div className={className ? `render-root ${className}` : "render-root"} style={style}>
      {children}
    </div>
  );
}
