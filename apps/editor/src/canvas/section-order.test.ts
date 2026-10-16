import { describe, expect, it } from "vitest";
import { reorderStepIndex } from "./section-order";

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
