import { describe, expect, it } from "vitest";
import { isEditableTarget } from "./is-editable-target";

describe("isEditableTarget", () => {
  it.each([
    [{ tagName: "INPUT" }, true],
    [{ tagName: "textarea" }, true],
    [{ tagName: "SELECT" }, true],
    [{ tagName: "DIV", isContentEditable: true }, true],
    [{ tagName: "DIV", isContentEditable: false }, false],
    [{ tagName: "MAIN" }, false],
    [null, false],
  ])("%o → %s", (target, expected) => {
    expect(isEditableTarget(target)).toBe(expected);
  });
});
