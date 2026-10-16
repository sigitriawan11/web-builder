import { describe, expect, it } from "vitest";
import { type Arrow, isArrow, nudgeOffset, reorderDirection } from "./nudge";

describe("nudge (ED-064)", () => {
  it("isArrow mengenali keempat tombol panah", () => {
    expect(isArrow("ArrowLeft")).toBe(true);
    expect(isArrow("Enter")).toBe(false);
  });

  it("nudgeOffset: satu sumbu sesuai arah & besaran", () => {
    expect(nudgeOffset("ArrowLeft", 1)).toEqual({ x: -1, y: 0 });
    expect(nudgeOffset("ArrowRight", 10)).toEqual({ x: 10, y: 0 });
    expect(nudgeOffset("ArrowUp", 1)).toEqual({ x: 0, y: -1 });
    expect(nudgeOffset("ArrowDown", 10)).toEqual({ x: 0, y: 10 });
  });

  it("reorderDirection: ←/↑ prev, →/↓ next", () => {
    const dirs: Record<Arrow, "up" | "down"> = {
      ArrowLeft: "up",
      ArrowUp: "up",
      ArrowRight: "down",
      ArrowDown: "down",
    };
    for (const [arrow, dir] of Object.entries(dirs)) expect(reorderDirection(arrow as Arrow)).toBe(dir);
  });
});
