import { UUIDV7_PATTERN } from "@platform/shared";
import { getContext } from "@platform/shared/node";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createApiLogger } from "../server";
import { safeUrl } from "./http-logger";
import { corsFor } from "./security";

function setup() {
  const lines: Record<string, unknown>[] = [];
  // Logger yang sama dengan server produksi (createApiLogger), hanya tujuannya ditangkap.
  const logger = createApiLogger(
    { APP_ENV: "staging", LOG_LEVEL: "info" },
    { write: (line: string) => void lines.push(JSON.parse(line)) },
  );
  const app = createApp({
    logger,
    mountRoutes: (app) => {
      app.get("/echo-context", (_req, res) => {
        res.json({ context: getContext(), ctx: _req.ctx });
      });
      app.post("/echo-body", (req, res) => {
        res.json({ isBuffer: Buffer.isBuffer(req.body), body: Buffer.isBuffer(req.body) ? req.body.length : req.body });
      });
      app.post("/webhooks/test", (req, res) => {
        res.json({
          isBuffer: Buffer.isBuffer(req.body),
          text: Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null,
        });
      });
      const publicRouter = express.Router();
      publicRouter.use(corsFor(["http://app.localhost:3000"]));
      publicRouter.get("/", (_req, res) => {
        res.json({ ok: true });
      });
      app.use("/public", publicRouter);
    },
  });
  return { app, lines };
}

describe("requestId (middleware 1)", () => {
  it("tanpa header → UUIDv7 baru di header response & konteks async", async () => {
    const { app } = setup();
    const response = await request(app).get("/echo-context");
    const id = response.headers["x-request-id"];
    expect(id).toMatch(UUIDV7_PATTERN);
    expect(response.body).toEqual({ context: { requestId: id }, ctx: { requestId: id } });
  });

  it("header dari edge dipakai bila formatnya aman; yang berbahaya diganti", async () => {
    const { app } = setup();
    const kept = await request(app).get("/echo-context").set("x-request-id", "edge-req-12345678");
    expect(kept.headers["x-request-id"]).toBe("edge-req-12345678");
    for (const bad of ["pendek", "a".repeat(200), "evil\\nINFO palsu", "<script>x</script>"]) {
      const replaced = await request(app).get("/echo-context").set("x-request-id", bad);
      expect(replaced.headers["x-request-id"]).toMatch(UUIDV7_PATTERN);
    }
  });
});

describe("httpLogger (middleware 2)", () => {
  it("satu log per request dengan requestId, tanpa cookie/authorization; query sensitif disamarkan", async () => {
    const { app, lines } = setup();
    const response = await request(app)
      .get("/echo-context?token=rahasia-token&page=2")
      .set("cookie", "better-auth.session=rahasia-cookie")
      .set("authorization", "Bearer rahasia-bearer");
    const entry = lines.find((line) => line.msg === "request completed");
    expect(entry).toMatchObject({
      requestId: response.headers["x-request-id"],
      req: { method: "GET", url: "/echo-context?token=%5BREDACTED%5D&page=2" },
      res: { statusCode: 200 },
    });
    // Lapis 1: header tidak dicatat sama sekali (lapis 2 = redaksi logger, T1.2.4).
    expect(entry?.req).not.toHaveProperty("headers");
    const text = JSON.stringify(lines);
    for (const secret of ["rahasia-token", "rahasia-cookie", "rahasia-bearer"]) expect(text).not.toContain(secret);
  });

  it("health check tidak dicatat", async () => {
    const { app, lines } = setup();
    await request(app).get("/health/live");
    expect(lines.filter((line) => line.msg === "request completed")).toHaveLength(0);
  });

  it("safeUrl menyamarkan parameter sensitif saja", () => {
    expect(safeUrl("/verify?code=123&signature=abc&lang=id")).toBe(
      "/verify?code=%5BREDACTED%5D&signature=%5BREDACTED%5D&lang=id",
    );
    expect(safeUrl("/sites")).toBe("/sites");
  });
});

describe("security headers & CORS (middleware 3–4)", () => {
  it("helmet: nosniff, CSP ketat, tanpa x-powered-by", async () => {
    const { app } = setup();
    const response = await request(app).get("/health/live");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("CORS hanya di router publik & hanya origin yang diizinkan", async () => {
    const { app } = setup();
    const allowed = await request(app).get("/public").set("origin", "http://app.localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://app.localhost:3000");
    const other = await request(app).get("/public").set("origin", "https://jahat.example");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
    const global = await request(app).get("/health/live").set("origin", "http://app.localhost:3000");
    expect(global.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("body parsers (middleware 5)", () => {
  it("JSON di-parse; > 1 MB ditolak 413", async () => {
    const { app } = setup();
    expect((await request(app).post("/echo-body").send({ a: 1 })).body).toEqual({ isBuffer: false, body: { a: 1 } });
    const big = await request(app)
      .post("/echo-body")
      .set("content-type", "application/json")
      .send(`{"x":"${"a".repeat(1_100_000)}"}`);
    expect(big.status).toBe(413);
  });

  it("webhook menerima byte asli (raw) walau content-type JSON — untuk verifikasi signature", async () => {
    const { app } = setup();
    const raw = '{"order_id":"A1",  "status":"paid"}';
    const response = await request(app).post("/webhooks/test").set("content-type", "application/json").send(raw);
    expect(response.body).toEqual({ isBuffer: true, text: raw });
  });

  it("biner application/octet-stream (update Yjs) diterima sebagai Buffer", async () => {
    const { app } = setup();
    const response = await request(app)
      .post("/echo-body")
      .set("content-type", "application/octet-stream")
      .send(Buffer.from([0, 1, 2, 255]));
    expect(response.body).toEqual({ isBuffer: true, body: 4 });
  });
});
