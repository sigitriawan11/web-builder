import { isAppError } from "@platform/shared";
import { describe, expect, it } from "vitest";
import { assertComponentTransition, canTransition } from "./library-admin.status";

describe("component status state machine (CMP-040)", () => {
  it("mengizinkan alur normal draft → in_review → published → deprecated → archived", () => {
    expect(canTransition("draft", "in_review")).toBe(true);
    expect(canTransition("in_review", "published")).toBe(true);
    expect(canTransition("published", "deprecated")).toBe(true);
    expect(canTransition("deprecated", "archived")).toBe(true);
  });

  it("mengizinkan reject (in_review → draft) & restore (deprecated → published)", () => {
    expect(canTransition("in_review", "draft")).toBe(true);
    expect(canTransition("deprecated", "published")).toBe(true);
  });

  it("menolak transisi terlarang", () => {
    expect(canTransition("draft", "published")).toBe(false);
    expect(canTransition("draft", "deprecated")).toBe(false);
    expect(canTransition("published", "draft")).toBe(false);
    expect(canTransition("published", "archived")).toBe(false);
    expect(canTransition("archived", "published")).toBe(false);
    expect(canTransition("archived", "draft")).toBe(false);
  });

  it("assertComponentTransition melempar CONFLICT untuk transisi tak valid", () => {
    expect(() => assertComponentTransition("draft", "deprecated")).toThrow();
    try {
      assertComponentTransition("draft", "deprecated");
    } catch (error) {
      expect(isAppError(error)).toBe(true);
      if (isAppError(error)) expect(error.code).toBe("CONFLICT");
    }
    expect(() => assertComponentTransition("published", "deprecated")).not.toThrow();
  });
});
