import { ErrorBodySchema } from "@platform/shared/contracts";
import { signInternalToken, signToken } from "@platform/shared/node";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { silentLogger } from "../test-utils";

const SECRET = "internal-secret-0123456789abcdefghij";
const app = () => createApp({ logger: silentLogger(), internalJwtSecret: SECRET });
const ping = (authorization?: string) => {
  const call = request(app()).get("/internal/v1/ping");
  return authorization === undefined ? call : call.set("authorization", authorization);
};

describe("router /internal/v1 (ARCHITECTURE §9.3)", () => {
  it("tanpa token → 401 UNAUTHENTICATED (envelope standar)", async () => {
    const response = await ping();
    expect(response.status).toBe(401);
    expect(ErrorBodySchema.parse(response.body).error.code).toBe("UNAUTHENTICATED");
  });

  it("token service valid (aud api) → 200, service pemanggil diketahui", async () => {
    const token = await signInternalToken(SECRET, { service: "worker", audience: "api" });
    const response = await ping(`Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ service: "worker" });
  });

  it("semua token tidak sah → 401 yang sama", async () => {
    const wrongSecret = await signInternalToken("x".repeat(40), { service: "worker", audience: "api" });
    const otherAudience = await signInternalToken(SECRET, { service: "worker", audience: "realtime" });
    const expired = await signInternalToken(SECRET, {
      service: "worker",
      audience: "api",
      now: () => Date.now() - 120_000,
    });
    // Token user (mis. realtime token) bukan token service walau secret sama.
    const notService = await signToken(
      SECRET,
      { sub: "0199e000-0000-7000-8000-000000000001" },
      { audience: "api", expiresInSeconds: 60 },
    );
    for (const authorization of [
      `Basic ${Buffer.from("worker:pass").toString("base64")}`,
      "Bearer ",
      "Bearer bukan.jwt.sah",
      `Bearer ${wrongSecret}`,
      `Bearer ${otherAudience}`,
      `Bearer ${expired}`,
      `Bearer ${notService}`,
    ]) {
      const response = await ping(authorization);
      expect(response.status, authorization.slice(0, 20)).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("tanpa secret terkonfigurasi, router internal tidak dipasang (404)", async () => {
    expect((await request(createApp({ logger: silentLogger() })).get("/internal/v1/ping")).status).toBe(404);
  });
});
