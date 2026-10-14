import type { BreakpointDef, BreakpointId } from "../schema";

/**
 * Breakpoint efektif untuk lebar viewport (DM-035), sama dengan media query publish desktop-first
 * `@media (max-width: N)`: breakpoint dengan `maxWidth` terkecil yang masih ≥ lebar; selain itu `base`.
 */
export function breakpointForWidth(width: number, breakpoints: readonly BreakpointDef[]): BreakpointId {
  let match: BreakpointDef | undefined;
  for (const breakpoint of breakpoints) {
    if (breakpoint.maxWidth === null || width > breakpoint.maxWidth) continue;
    if (!match || match.maxWidth === null || breakpoint.maxWidth < match.maxWidth) match = breakpoint;
  }
  return match?.id ?? "base";
}
