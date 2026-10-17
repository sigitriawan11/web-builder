import { describe, expect, it } from "vitest";
import { needsAltWarning } from "./image-alt";

describe("needsAltWarning (ED-210)", () => {
  it("peringatan bila bukan dekoratif & alt kosong/spasi", () => {
    expect(needsAltWarning(undefined, undefined)).toBe(true);
    expect(needsAltWarning("", false)).toBe(true);
    expect(needsAltWarning("   ", false)).toBe(true);
  });
  it("tidak peringatan bila ada alt", () => {
    expect(needsAltWarning("Foto produk", false)).toBe(false);
  });
  it("dekoratif → tidak pernah peringatan (alt kosong disengaja)", () => {
    expect(needsAltWarning("", true)).toBe(false);
    expect(needsAltWarning(undefined, true)).toBe(false);
  });
});
