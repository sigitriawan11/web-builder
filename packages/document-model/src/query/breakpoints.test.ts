import { describe, expect, it } from "vitest";
import { DEFAULT_BREAKPOINTS } from "../defaults/top-level";
import { breakpointForWidth } from "./breakpoints";

// T1.8.11: AC DM-035 — breakpoint efektif dari lebar, sama dengan media query publish `max-width`.
describe("breakpointForWidth", () => {
  it.each([
    [1440, "base"],
    [992, "base"],
    [991, "tablet"],
    [768, "tablet"],
    [480, "tablet"],
    [479, "mobile"],
    [320, "mobile"],
  ] as const)("lebar %i → %s", (width, expected) => {
    expect(breakpointForWidth(width, DEFAULT_BREAKPOINTS)).toBe(expected);
  });

  it("memakai maxWidth dari settings, tidak bergantung urutan array", () => {
    const custom = [
      { ...DEFAULT_BREAKPOINTS[2], maxWidth: 599 },
      { ...DEFAULT_BREAKPOINTS[0] },
      { ...DEFAULT_BREAKPOINTS[1], maxWidth: 1199 },
    ].map((bp) => bp as (typeof DEFAULT_BREAKPOINTS)[number]);
    expect(breakpointForWidth(1100, custom)).toBe("tablet");
    expect(breakpointForWidth(599, custom)).toBe("mobile");
    expect(breakpointForWidth(1200, custom)).toBe("base");
  });
});
