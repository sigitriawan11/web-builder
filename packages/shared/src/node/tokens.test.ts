import { describe, expect, it } from "vitest";
import { z } from "zod";
import { signToken, verifyToken } from "./tokens";

const SECRET = "s".repeat(32);
const Claims = z.object({ sub: z.string(), docId: z.string() });
const at = (seconds: number) => () => 1_790_000_000_000 + seconds * 1000;

describe("signToken / verifyToken (ARCHITECTURE §9.3)", () => {
  it("bolak-balik: klaim tervalidasi Zod", async () => {
    const token = await signToken(SECRET, { sub: "u1", docId: "d1" }, { audience: "realtime", expiresInSeconds: 300 });
    expect(token.split(".")).toHaveLength(3);
    const result = await verifyToken(SECRET, token, { audience: "realtime", claims: Claims });
    expect(result).toMatchObject({ ok: true, value: { sub: "u1", docId: "d1" } });
  });

  it("kedaluwarsa → EXPIRED", async () => {
    const token = await signToken(
      SECRET,
      { sub: "u1", docId: "d1" },
      { audience: "realtime", expiresInSeconds: 60, now: at(0) },
    );
    expect(await verifyToken(SECRET, token, { audience: "realtime", claims: Claims, now: at(30) })).toMatchObject({
      ok: true,
    });
    expect(await verifyToken(SECRET, token, { audience: "realtime", claims: Claims, now: at(61) })).toEqual({
      ok: false,
      error: "EXPIRED",
    });
  });

  it("secret salah, audience lain, payload diubah, klaim tidak cocok → INVALID", async () => {
    const token = await signToken(SECRET, { sub: "u1", docId: "d1" }, { audience: "realtime", expiresInSeconds: 300 });
    const invalid = { ok: false, error: "INVALID" };
    expect(await verifyToken("x".repeat(32), token, { audience: "realtime", claims: Claims })).toEqual(invalid);
    expect(await verifyToken(SECRET, token, { audience: "ai-stream", claims: Claims })).toEqual(invalid);
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "admin", docId: "d1", aud: "realtime", exp: 9_999_999_999 }),
    ).toString("base64url");
    expect(
      await verifyToken(SECRET, `${header}.${forged}.${signature}`, { audience: "realtime", claims: Claims }),
    ).toEqual(invalid);
    expect(await verifyToken(SECRET, token, { audience: "realtime", claims: z.object({ runId: z.string() }) })).toEqual(
      invalid,
    );
    expect(await verifyToken(SECRET, "bukan.jwt", { audience: "realtime", claims: Claims })).toEqual(invalid);
  });

  it("token `alg: none` (tanpa tanda tangan) ditolak", async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: "u1", docId: "d1", aud: "realtime", exp: 9_999_999_999 })}.`;
    expect(await verifyToken(SECRET, unsigned, { audience: "realtime", claims: Claims })).toEqual({
      ok: false,
      error: "INVALID",
    });
  });

  it("secret terlalu pendek ditolak saat sign maupun verify", async () => {
    await expect(signToken("pendek", {}, { audience: "x", expiresInSeconds: 60 })).rejects.toThrow(RangeError);
    await expect(verifyToken("pendek", "a.b.c", { audience: "x", claims: Claims })).rejects.toThrow(RangeError);
  });
});
