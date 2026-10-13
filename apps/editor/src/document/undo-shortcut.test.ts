import { describe, expect, it } from "vitest";
import { undoShortcut } from "./undo-shortcut";

const key = (code: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("undoShortcut (ED-197)", () => {
  it.each([
    [key("KeyZ", { ctrlKey: true }), "undo"],
    [key("KeyZ", { metaKey: true }), "undo"],
    [key("KeyZ", { ctrlKey: true, shiftKey: true }), "redo"],
    [key("KeyZ", { metaKey: true, shiftKey: true }), "redo"],
    [key("KeyY", { ctrlKey: true }), "redo"],
    [key("KeyZ"), null],
    [key("KeyZ", { ctrlKey: true, altKey: true }), null],
    [key("KeyY", { ctrlKey: true, shiftKey: true }), null],
    [key("KeyX", { ctrlKey: true }), null],
  ])("%o → %s", (input, expected) => {
    expect(undoShortcut(input)).toBe(expected);
  });
});
