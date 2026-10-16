import { describe, expect, it } from "vitest";
import { reorderStepIndex, zOrderIndex } from "./section-order";

describe("reorderStepIndex (ED-036)", () => {
  it("naik/turun satu posisi; berhenti di ujung", () => {
    expect(reorderStepIndex(3, 1, "up")).toBe(0);
    expect(reorderStepIndex(3, 1, "down")).toBe(2);
    expect(reorderStepIndex(3, 0, "up")).toBeNull();
    expect(reorderStepIndex(3, 2, "down")).toBeNull();
    expect(reorderStepIndex(3, -1, "up")).toBeNull();
    expect(reorderStepIndex(1, 0, "down")).toBeNull();
  });
});

describe("zOrderIndex (ED-091)", () => {
  it("forward/backward ±1, front/back ke ujung, null bila sudah di sana", () => {
    expect(zOrderIndex(4, 1, "forward")).toBe(2);
    expect(zOrderIndex(4, 1, "backward")).toBe(0);
    expect(zOrderIndex(4, 1, "front")).toBe(3);
    expect(zOrderIndex(4, 1, "back")).toBe(0);
    expect(zOrderIndex(4, 3, "front")).toBeNull();
    expect(zOrderIndex(4, 0, "back")).toBeNull();
    expect(zOrderIndex(4, 3, "forward")).toBeNull();
    expect(zOrderIndex(4, 0, "backward")).toBeNull();
  });
});
