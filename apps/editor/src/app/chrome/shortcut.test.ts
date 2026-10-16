import { describe, expect, it } from "vitest";
import { ariaShortcut, formatShortcut, isMacPlatform, matchesShortcut } from "./shortcut";

const key = (code: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>> = {}) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("shortcut (ED-006)", () => {
  it("format Windows/Linux vs Mac", () => {
    expect(formatShortcut({ code: "KeyK", mod: true, shift: true }, false)).toBe("Ctrl+Shift+K");
    expect(formatShortcut({ code: "KeyK", mod: true, shift: true }, true)).toBe("⇧⌘K");
    expect(formatShortcut({ code: "Digit0", mod: true }, false)).toBe("Ctrl+0");
    expect(formatShortcut({ code: "Equal", mod: true }, false)).toBe("Ctrl++");
    expect(formatShortcut({ code: "Backslash", mod: true }, false)).toBe("Ctrl+\\");
    expect(formatShortcut({ code: "KeyV" }, false)).toBe("V");
  });

  it("aria-keyshortcuts memakai nama kunci ARIA", () => {
    expect(ariaShortcut({ code: "KeyZ", mod: true, shift: true }, false)).toBe("Control+Shift+Z");
    expect(ariaShortcut({ code: "KeyZ", mod: true }, true)).toBe("Meta+Z");
  });

  it("modifier harus persis; Ctrl atau ⌘ sama-sama Mod", () => {
    expect(matchesShortcut(key("KeyV"), { code: "KeyV" })).toBe(true);
    expect(matchesShortcut(key("KeyV", { ctrlKey: true }), { code: "KeyV" })).toBe(false);
    expect(
      matchesShortcut(key("KeyK", { metaKey: true, shiftKey: true }), { code: "KeyK", mod: true, shift: true }),
    ).toBe(true);
    expect(matchesShortcut(key("KeyK", { ctrlKey: true }), { code: "KeyK", mod: true, shift: true })).toBe(false);
  });

  it("deteksi Mac dari platform", () => {
    expect(isMacPlatform("MacIntel")).toBe(true);
    expect(isMacPlatform("Win32")).toBe(false);
  });
});
