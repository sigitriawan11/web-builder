import { describe, expect, it } from "vitest";
import { parseZoomInput } from "./zoom-input";

describe("parseZoomInput (ED-009)", () => {
  it.each([
    ["150", 1.5],
    ["150%", 1.5],
    [" 75 % ", 0.75],
    ["1.5x", 1.5],
    ["1,5x", 1.5],
    ["99999", 16],
    ["1", 0.05],
  ])("%s → %s", (input, zoom) => {
    expect(parseZoomInput(input)).toBe(zoom);
  });

  it.each(["", "abc", "-10", "0", "10px", "1e3"])("tidak valid: %j", (input) => {
    expect(parseZoomInput(input)).toBeNull();
  });
});
