import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { err, ok, type Result, unwrap } from "./result";

function parsePort(input: string): Result<number, "NOT_A_NUMBER"> {
  const value = Number(input);
  return Number.isInteger(value) ? ok(value) : err("NOT_A_NUMBER");
}

describe("Result (ARCHITECTURE §18)", () => {
  it("ok/err membentuk union yang bisa dipersempit lewat `ok`", () => {
    const good = parsePort("4000");
    const bad = parsePort("abc");
    expect(good).toEqual({ ok: true, value: 4000 });
    expect(bad).toEqual({ ok: false, error: "NOT_A_NUMBER" });
    if (!bad.ok) expect(bad.error).toBe("NOT_A_NUMBER");
  });

  it("unwrap mengembalikan nilai atau melempar error hasil pemetaan", () => {
    expect(unwrap(parsePort("1"), () => new Error("x"))).toBe(1);
    expect(() => unwrap(parsePort("x"), () => new AppError("VALIDATION_FAILED"))).toThrow(AppError);
  });
});
