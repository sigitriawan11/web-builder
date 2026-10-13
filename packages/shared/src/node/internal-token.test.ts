import { describe, expect, it } from "vitest";
import { INTERNAL_TOKEN_TTL_SECONDS, signInternalToken, verifyInternalToken } from "./internal-token";

const SECRET = "internal-secret-0123456789abcdefghij";

describe("internal token (ARCHITECTURE §9.3)", () => {
  it("sub = service pemanggil, aud = tujuan, umur 60 s", async () => {
    const token = await signInternalToken(SECRET, { service: "worker", audience: "api", now: () => 1_790_000_000_000 });
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
    expect(payload).toMatchObject({ sub: "worker", aud: "api" });
    expect(payload.exp - payload.iat).toBe(INTERNAL_TOKEN_TTL_SECONDS);
    expect(await verifyInternalToken(SECRET, token, { audience: "api", now: () => 1_790_000_030_000 })).toEqual({
      ok: true,
      value: expect.objectContaining({ sub: "worker" }),
    });
  });

  it("audience lain atau kedaluwarsa ditolak", async () => {
    const token = await signInternalToken(SECRET, {
      service: "worker",
      audience: "realtime",
      now: () => 1_790_000_000_000,
    });
    expect((await verifyInternalToken(SECRET, token, { audience: "api", now: () => 1_790_000_010_000 })).ok).toBe(
      false,
    );
    expect(await verifyInternalToken(SECRET, token, { audience: "realtime", now: () => 1_790_000_061_000 })).toEqual({
      ok: false,
      error: "EXPIRED",
    });
  });
});
