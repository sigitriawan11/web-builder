import { describe, expect, it } from "vitest";
import { toFailure } from "./client";

describe("toFailure — dua bentuk error api diseragamkan", () => {
  it("envelope api: code, details, Retry-After dari header", () => {
    expect(
      toFailure(
        422,
        { error: { code: "WEAK_PASSWORD", message: "x", details: { reason: "common" }, requestId: "r" } },
        null,
      ),
    ).toEqual({
      ok: false,
      status: 422,
      code: "WEAK_PASSWORD",
      details: { reason: "common" },
      retryAfterSeconds: null,
    });
    expect(toFailure(429, { error: { code: "RATE_LIMITED", message: "x", requestId: "r" } }, "900")).toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 900,
    });
  });

  it("Better Auth `{ code, message }`", () => {
    expect(toFailure(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" }, null)).toMatchObject({
      code: "INVALID_EMAIL_OR_PASSWORD",
      details: {},
    });
  });

  it("badan kosong/rusak → kode dari status; retryAfterSeconds dari details bila header tidak ada", () => {
    expect(toFailure(500, null, null).code).toBe("HTTP_500");
    expect(toFailure(429, "teks", null).code).toBe("RATE_LIMITED");
    expect(
      toFailure(429, { error: { code: "RATE_LIMITED", details: { retryAfterSeconds: 60 } } }, "bukan-angka")
        .retryAfterSeconds,
    ).toBe(60);
  });
});
