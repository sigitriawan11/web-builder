import { describe, expect, it } from "vitest";
import { createLogger, REDACTED, redactSensitive } from "./logger";

function capture(mixin?: () => Record<string, unknown>) {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    service: "api",
    env: "local",
    level: "debug",
    destination: { write: (line: string) => void lines.push(JSON.parse(line)) },
    ...(mixin ? { mixin } : {}),
  });
  return { logger, lines };
}

describe("logger (ARCHITECTURE §13)", () => {
  it("field wajib service & env + mixin konteks (requestId) di setiap baris", () => {
    const { logger, lines } = capture(() => ({ requestId: "req-1" }));
    logger.info({ siteId: "s1" }, "situs dibuat");
    expect(lines[0]).toMatchObject({
      service: "api",
      env: "local",
      requestId: "req-1",
      siteId: "s1",
      msg: "situs dibuat",
    });
    expect(typeof lines[0]?.time).toBe("string");
  });

  it("redaksi password, token, authorization, cookie, credentials*, serverKey di kedalaman berapa pun", () => {
    const { logger, lines } = capture();
    logger.info(
      {
        password: "rahasia1",
        user: { email: "a@b.test", password: "rahasia2" },
        req: { headers: { authorization: "Bearer abc", cookie: "sid=xyz", "set-cookie": ["a=b"], accept: "*/*" } },
        token: "t1",
        accessToken: "t2",
        refresh_token: "t3",
        credentialsDekEncrypted: "dek",
        gateway: { serverKey: "SB-Mid-server-xyz", clientKey: "publik" },
        items: [{ apiKey: "k1" }],
      },
      "login",
    );
    const line = lines[0] ?? {};
    const text = JSON.stringify(line);
    for (const secret of [
      "rahasia1",
      "rahasia2",
      "Bearer abc",
      "sid=xyz",
      "a=b",
      "t1",
      "t2",
      "t3",
      "dek",
      "SB-Mid-server-xyz",
      "k1",
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(line).toMatchObject({
      password: REDACTED,
      user: { email: "a@b.test", password: REDACTED },
      req: { headers: { authorization: REDACTED, cookie: REDACTED, accept: "*/*" } },
      gateway: { serverKey: REDACTED, clientKey: "publik" },
    });
  });

  it("child bindings & mixin ikut diredaksi", () => {
    const { logger, lines } = capture(() => ({ sessionToken: "rahasia-mixin" }));
    logger.child({ requestId: "r2", cookie: "rahasia-child" }).warn("x");
    expect(JSON.stringify(lines[0])).not.toMatch(/rahasia-(mixin|child)/);
    expect(lines[0]).toMatchObject({ requestId: "r2" });
  });

  it("key yang hanya mirip tidak diredaksi (tokenCount, passwordPolicy tetap)", () => {
    expect(redactSensitive({ tokenCount: 3, passwordPolicy: "min 8", tokens: 10 })).toEqual({
      tokenCount: 3,
      passwordPolicy: "min 8",
      tokens: 10,
    });
  });

  it("Error tetap terserialisasi (pesan & stack) lewat key err", () => {
    const { logger, lines } = capture();
    logger.error({ err: new Error("db timeout") }, "gagal");
    expect(lines[0]).toMatchObject({ err: { message: "db timeout", type: "Error" } });
  });
});
