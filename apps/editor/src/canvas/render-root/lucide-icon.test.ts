import { describe, expect, it } from "vitest";
import { isIconName, kebabToPascal, pascalToKebab, searchIcons } from "./lucide-icon";

describe("lucide icon mapping (DM-015)", () => {
  it("kebab ↔ pascal", () => {
    expect(kebabToPascal("phone")).toBe("Phone");
    expect(kebabToPascal("air-vent")).toBe("AirVent");
    expect(pascalToKebab("AirVent")).toBe("air-vent");
    expect(pascalToKebab("AArrowDown")).toBe("a-arrow-down");
  });

  it("isIconName mengenali ikon valid", () => {
    expect(isIconName("phone")).toBe(true);
    expect(isIconName("air-vent")).toBe(true);
    expect(isIconName("bukan-ikon-xyz")).toBe(false);
  });

  it("search memfilter nama & membatasi hasil", () => {
    const phones = searchIcons("phone");
    expect(phones.length).toBeGreaterThan(0);
    expect(phones).toContain("phone");
    expect(phones.every((name) => name.includes("phone"))).toBe(true);
    expect(searchIcons("", 10)).toHaveLength(10);
    expect(searchIcons("zzz-tidak-ada")).toEqual([]);
    // Spasi → tanda hubung.
    expect(searchIcons("air vent")).toContain("air-vent");
  });
});
