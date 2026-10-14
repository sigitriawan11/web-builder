import { uuidv7 } from "@platform/shared";
import { REALTIME_TOKEN_AUDIENCE } from "@platform/shared/contracts";
import { signToken } from "@platform/shared/node";
import { describe, expect, it } from "vitest";
import { authenticateConnection, RealtimeAuthError } from "./auth";

// T1.12.1: alasan penolakan internal (untuk log) — klien hanya menerima `permission-denied`.
const SECRET = "test-realtime-secret-0123456789abcdef";
const claims = { sub: uuidv7(), docId: uuidv7(), siteId: null, role: "owner" } as const;
const sign = (now = Date.now()) =>
  signToken(SECRET, claims, { expiresInSeconds: 300, audience: REALTIME_TOKEN_AUDIENCE, now: () => now });

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "none";
  } catch (error) {
    return error instanceof RealtimeAuthError ? error.failure : "other";
  }
}

describe("authenticateConnection", () => {
  it("konteks dari klaim token", async () => {
    await expect(authenticateConnection(SECRET, await sign(), claims.docId)).resolves.toEqual({
      userId: claims.sub,
      docId: claims.docId,
      siteId: null,
      role: "owner",
    });
  });

  it("alasan: INVALID, EXPIRED, DOCUMENT_MISMATCH; pesan error selalu generik", async () => {
    expect(await failure(authenticateConnection(SECRET, "x.y.z", claims.docId))).toBe("INVALID");
    expect(await failure(authenticateConnection(SECRET, await sign(Date.now() - 3_600_000), claims.docId))).toBe(
      "EXPIRED",
    );
    expect(await failure(authenticateConnection(SECRET, await sign(), uuidv7()))).toBe("DOCUMENT_MISMATCH");
    await expect(authenticateConnection(SECRET, await sign(), uuidv7())).rejects.toThrow(/^permission-denied$/);
  });
});
