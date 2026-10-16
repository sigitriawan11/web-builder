import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initServerTelemetry, redactPath, type ServerReporter, scrubServerEvent } from "./telemetry";

// Server ingest Sentry palsu: menampung envelope yang benar-benar dikirim transport @sentry/node.
let server: Server;
const envelopes: string[] = [];
let reporter: ServerReporter;

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      envelopes.push((request.headers["content-encoding"] === "gzip" ? gunzipSync(body) : body).toString("utf8"));
      response.writeHead(200).end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  reporter = initServerTelemetry({
    service: "api",
    dsn: `http://publickey@127.0.0.1:${port}/1`,
    environment: "test",
    release: "abc123",
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("initServerTelemetry (T1.16.3)", () => {
  it("tanpa DSN → reporter no-op", async () => {
    const disabled = initServerTelemetry({ service: "worker" });
    expect(disabled.enabled).toBe(false);
    disabled.report(new Error("x"));
    expect(await disabled.flush()).toBe(true);
  });

  it("error contoh terkirim ke Sentry dengan tag service/request_id, release & environment; tanpa ID mentah", async () => {
    const siteId = "01a14398-46f8-77e4-b1d9-ab7ef2dee821";
    reporter.report(new Error("contoh error api"), {
      request_id: "req-123",
      path: `/v1/sites/${siteId}/pages?token=rahasia`,
    });
    await reporter.flush();
    const event = envelopes.find((body) => body.includes("contoh error api")) ?? "";
    expect(event).toContain('"service":"api"');
    expect(event).toContain('"request_id":"req-123"');
    expect(event).toContain('"path":"/v1/sites/:id/pages"');
    expect(event).toContain('"release":"abc123"');
    expect(event).toContain('"environment":"test"');
    expect(event).not.toContain(siteId);
    expect(event).not.toContain("rahasia");
  });
});

describe("scrubServerEvent", () => {
  it("membuang header/cookie/body request, user, extra, breadcrumb console", () => {
    const scrubbed = scrubServerEvent({
      type: undefined,
      request: {
        method: "POST",
        url: "http://api.localhost:4000/v1/auth/x?code=999",
        headers: { cookie: "platform.session_token=abc", authorization: "Bearer xyz" },
        data: '{"password":"Kopi-Susu"}',
      },
      user: { id: "u1", email: "sari@contoh.id", ip_address: "10.0.0.1" },
      extra: { body: "Kopi-Susu" },
      transaction: "POST /v1/sites/01a14398-46f8-77e4-b1d9-ab7ef2dee821",
      breadcrumbs: [
        { category: "console", message: "payload Kopi-Susu" },
        { category: "http", data: { url: "http://x/y?token=abc", method: "GET" } },
      ],
    });
    const json = JSON.stringify(scrubbed);
    for (const secret of ["Kopi-Susu", "abc", "xyz", "sari@contoh.id", "10.0.0.1", "999"]) {
      expect(json).not.toContain(secret);
    }
    expect(scrubbed.request).toEqual({ method: "POST", url: "http://api.localhost:4000/v1/auth/x" });
    expect(scrubbed.transaction).toBe("POST /v1/sites/:id");
    expect(scrubbed.breadcrumbs).toEqual([{ category: "http", data: { method: "GET", url: "http://x/y" } }]);
  });

  it("redactPath", () => {
    expect(redactPath("/a/01a14398-46f8-77e4-b1d9-ab7ef2dee821/b?c=1")).toBe("/a/:id/b");
  });
});
