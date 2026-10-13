import { describe, expect, it } from "vitest";
import { isBlockedBrowserShortcut } from "./browser-guards";

const key = (value: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key: value,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe("isBlockedBrowserShortcut (ED-025)", () => {
  it.each(["s", "p", "d", "g", "S"])("Ctrl/⌘ + %s diblokir", (value) => {
    expect(isBlockedBrowserShortcut(key(value, { ctrlKey: true }))).toBe(true);
    expect(isBlockedBrowserShortcut(key(value, { metaKey: true }))).toBe(true);
  });

  it.each([
    ["huruf tanpa Mod", key("s")],
    ["Mod + shortcut editor (copy)", key("c", { ctrlKey: true })],
    ["Mod + Alt", key("s", { ctrlKey: true, altKey: true })],
  ])("%s tidak diblokir", (_, input) => {
    expect(isBlockedBrowserShortcut(input)).toBe(false);
  });
});
