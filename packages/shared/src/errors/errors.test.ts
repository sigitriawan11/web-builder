import { describe, expect, it } from "vitest";
import { AppError, ERROR_STATUS, ErrorCodeSchema, isAppError, statusForCode } from "./index";

describe("katalog kode error (ARCHITECTURE §5.3)", () => {
  it("memetakan kode ke status HTTP sesuai tabel konvensi response", () => {
    expect(ERROR_STATUS).toEqual({
      VALIDATION_FAILED: 422,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      PAYLOAD_TOO_LARGE: 413,
      PLAN_LIMIT_REACHED: 402,
      PLAN_FEATURE_REQUIRED: 402,
      INSUFFICIENT_CREDITS: 402,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
    });
    expect(statusForCode("NOT_FOUND")).toBe(404);
  });

  it("semua kode UPPER_SNAKE dan statusnya status error HTTP", () => {
    for (const [code, status] of Object.entries(ERROR_STATUS)) {
      expect(code).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  });

  it("ErrorCodeSchema menerima kode katalog saja (klien memvalidasi response error)", () => {
    expect(ErrorCodeSchema.parse("RATE_LIMITED")).toBe("RATE_LIMITED");
    expect(ErrorCodeSchema.safeParse("SOMETHING_ELSE").success).toBe(false);
  });
});

describe("AppError (ARCHITECTURE §18)", () => {
  it("status default dari katalog; details & cause dibawa", () => {
    const cause = new Error("db timeout");
    const error = new AppError("PLAN_LIMIT_REACHED", undefined, { limit: 3, current: 3 }, { cause });
    expect(error).toBeInstanceOf(Error);
    expect([error.name, error.code, error.status, error.message]).toEqual([
      "AppError",
      "PLAN_LIMIT_REACHED",
      402,
      "PLAN_LIMIT_REACHED",
    ]);
    expect(error.details).toEqual({ limit: 3, current: 3 });
    expect(error.cause).toBe(cause);
  });

  it("status eksplisit menimpa default (mis. CONFLICT sebagai 409 tetap, NOT_FOUND untuk tenant lain)", () => {
    expect(new AppError("FORBIDDEN", 404).status).toBe(404);
    expect(new AppError("NOT_FOUND", 404, undefined, { message: "site tidak ada" }).message).toBe("site tidak ada");
  });

  it("menolak status non-error agar tidak terkirim sebagai 200", () => {
    expect(() => new AppError("CONFLICT", 200)).toThrow(RangeError);
    expect(() => new AppError("CONFLICT", 600)).toThrow(RangeError);
  });

  it("isAppError mengenali instance & salinan dari bundle lain, menolak error biasa", () => {
    expect(isAppError(new AppError("NOT_FOUND"))).toBe(true);
    const foreign = Object.assign(new Error("x"), { name: "AppError", code: "NOT_FOUND", status: 404 });
    expect(isAppError(foreign)).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError({ name: "AppError", code: "NOT_FOUND" })).toBe(false);
  });
});
