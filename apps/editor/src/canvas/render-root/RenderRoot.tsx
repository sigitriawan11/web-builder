import type { Breakpoint, Theme } from "@platform/document-model";
import { tokenDeclarations } from "@platform/renderer";
import { type CSSProperties, type ReactNode, useMemo } from "react";
import { declarationsToStyle } from "./editor-style";

// Font dasar teks situs di canvas bila node tidak menentukan typography (sama dengan prototipe M0).
const DEFAULT_FONT_STACK = "system-ui, sans-serif";

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
  // Stack font-family teks situs (T0.4.7); default system-ui.
  fontStack?: string | undefined;
}

// Pembungkus canvas: menyediakan CSS variable token & font dasar teks situs (DM-041).
export function RenderScope({ children, theme, breakpoint, className, fontStack }: RenderScopeProps) {
  const style = useMemo(
    () => ({ ...tokenScopeStyle(theme, breakpoint), fontFamily: fontStack ?? DEFAULT_FONT_STACK }),
    [theme, breakpoint, fontStack],
  );
  return (
    <div className={className ? `render-root ${className}` : "render-root"} style={style}>
      {children}
    </div>
  );
}
