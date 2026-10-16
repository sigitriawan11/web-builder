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

describe("logger onError (T1.16.3)", () => {
  function reporting() {
    const reports: { error: unknown; tags: Record<string, string> }[] = [];
    const lines: Record<string, unknown>[] = [];
    const logger = createLogger({
      service: "worker",
      env: "local",
      destination: { write: (line: string) => void lines.push(JSON.parse(line)) },
      mixin: () => ({ requestId: "req-9" }),
      onError: (error, tags) => reports.push({ error, tags }),
    });
    return { logger, reports, lines };
  }

  it("log error dengan `err` dilaporkan sekali dengan tag ID dari field, child binding, & mixin; log tetap ditulis", () => {
    const { logger, reports, lines } = reporting();
    const error = new Error("flush gagal");
    logger.child({ queue: "email" }).error({ err: error, docId: "doc-1", password: "rahasia" }, "flush dokumen gagal");
    expect(reports).toHaveLength(1);
    expect(reports[0]?.error).toBe(error);
    expect(reports[0]?.tags).toEqual({ request_id: "req-9", queue: "email", doc_id: "doc-1" });
    expect(lines[0]).toMatchObject({ msg: "flush dokumen gagal", queue: "email", password: REDACTED });
  });

  it("level di bawah error / tanpa err tidak dilaporkan; fatal & Error langsung dilaporkan", () => {
    const { logger, reports } = reporting();
    logger.warn({ err: new Error("x") }, "peringatan");
    logger.error("tanpa objek");
    logger.error({ docId: "d" }, "tanpa err");
    logger.fatal(new Error("mati"));
    expect(reports.map((report) => (report.error instanceof Error ? report.error.message : null))).toEqual(["mati"]);
  });

  it("log akses HTTP (pino-http, ada responseTime) tidak dilaporkan — error asli dilaporkan error handler", () => {
    const { logger, reports } = reporting();
    logger.error({ err: new Error("failed with status code 500"), responseTime: 12 }, "request errored");
    expect(reports).toEqual([]);
  });

  it("pelapor yang melempar tidak mengganggu logging", () => {
    const lines: unknown[] = [];
    const logger = createLogger({
      service: "api",
      env: "local",
      destination: { write: (line: string) => void lines.push(line) },
      onError: () => {
        throw new Error("sentry mati");
      },
    });
    logger.error({ err: new Error("x") }, "tetap tertulis");
    expect(lines).toHaveLength(1);
  });
});
