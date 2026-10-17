import { describe, expect, it } from "vitest";
import { hexAlpha, hexToRgb, isValidHex, normalizeHex, rgbToHex } from "./color";

describe("normalizeHex (ED-102)", () => {
  it("shorthand 3/4 digit → panjang, lowercase, prefix #", () => {
    expect(normalizeHex("#FFF")).toBe("#ffffff");
    expect(normalizeHex("abc")).toBe("#aabbcc");
    expect(normalizeHex("#F0A8")).toBe("#ff00aa88");
  });
  it("6/8 digit valid; selain itu null", () => {
    expect(normalizeHex("#1E90FF")).toBe("#1e90ff");
    expect(normalizeHex("#1e90ff80")).toBe("#1e90ff80");
    expect(normalizeHex("xyz")).toBeNull();
    expect(normalizeHex("#12")).toBeNull();
  });
  it("isValidHex", () => {
    expect(isValidHex("#fff")).toBe(true);
    expect(isValidHex("nope")).toBe(false);
  });
});

describe("hexToRgb / rgbToHex (ED-102)", () => {
  it("hex → rgb (alpha diabaikan)", () => {
    expect(hexToRgb("#1e90ff")).toEqual({ r: 30, g: 144, b: 255 });
    expect(hexToRgb("#1e90ff80")).toEqual({ r: 30, g: 144, b: 255 });
    expect(hexToRgb("zzz")).toBeNull();
  });
  it("rgb → hex (di-clamp)", () => {
    expect(rgbToHex({ r: 30, g: 144, b: 255 })).toBe("#1e90ff");
    expect(rgbToHex({ r: -5, g: 300, b: 128 })).toBe("#00ff80");
  });
  it("round-trip", () => {
    const rgb = hexToRgb("#abcdef");
    expect(rgb && rgbToHex(rgb)).toBe("#abcdef");
  });
});

describe("hexAlpha (ED-102)", () => {
  it("8-digit → alpha; 6-digit → 1", () => {
    expect(hexAlpha("#1e90ff")).toBe(1);
    expect(hexAlpha("#1e90ff00")).toBe(0);
    expect(hexAlpha("#1e90ffff")).toBe(1);
    expect(hexAlpha("#1e90ff80")).toBeCloseTo(128 / 255, 5);
  });
});
