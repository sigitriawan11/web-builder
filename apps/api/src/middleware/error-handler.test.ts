import { hasMessage, LOCALES } from "@platform/i18n";
import { AppError, ERROR_STATUS } from "@platform/shared";
import { ErrorBodySchema } from "@platform/shared/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../app";
import { createApiLogger } from "../server";

function setup() {
  const lines: Record<string, unknown>[] = [];
  const reportError = vi.fn();
  const app = createApp({
    logger: createApiLogger(
      { APP_ENV: "staging", LOG_LEVEL: "info" },
      { write: (line: string) => void lines.push(JSON.parse(line)) },
    ),
    reportError,
    mountRoutes: (app) => {
      app.get("/limit", () => {
        throw new AppError("PLAN_LIMIT_REACHED", undefined, { key: "sites.max", used: 3, limit: 3 });
      });
      app.get("/zod", () => {
        z.object({ name: z.string() }).parse({});
      });
      app.get("/boom", async () => {
        throw new Error("koneksi db password=rahasia gagal");
      });
      app.get("/slow-down", () => {
        throw new AppError("RATE_LIMITED", undefined, { retryAfterSeconds: 12.2 });
      });
      app.post("/json", (req, res) => {
        res.json(req.body);
      });
    },
  });
  return { app, lines, reportError };
}

describe("errorHandler + notFound (ARCHITECTURE §5.3)", () => {
  it("1) AppError → status katalog + envelope; details & requestId ikut; pesan dari i18n", async () => {
    const { app, reportError } = setup();
    const response = await request(app).get("/limit");
    expect(response.status).toBe(402);
    expect(ErrorBodySchema.parse(response.body)).toEqual({
      error: {
        code: "PLAN_LIMIT_REACHED",
        message: "Batas paket Anda sudah tercapai. Upgrade paket untuk menambah kapasitas.",
        details: { key: "sites.max", used: 3, limit: 3 },
        requestId: response.headers["x-request-id"],
      },
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("2) ZodError yang lolos ke handler → 422 VALIDATION_FAILED + issues", async () => {
    const response = await request(setup().app).get("/zod");
    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_FAILED", details: { issues: [{ path: "name" }] } });
  });

  it("3) error tak terduga → 500 INTERNAL_ERROR generik; detail hanya di log & reporter", async () => {
    const { app, lines, reportError } = setup();
    const response = await request(app).get("/boom");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toMatch(/rahasia|koneksi db|stack/);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      requestId: response.headers["x-request-id"],
      method: "GET",
      path: "/boom",
    });
    expect(
      lines.some((line) => line.msg === "unhandled error" && line.requestId === response.headers["x-request-id"]),
    ).toBe(true);
  });

  it("T1.16.3: error tak terduga sampai ke Sentry lewat hook logger (onError) dengan tag request_id; 4xx tidak", async () => {
    const reports: { error: unknown; tags: Record<string, string> }[] = [];
    const app = createApp({
      logger: createApiLogger({ APP_ENV: "staging", LOG_LEVEL: "info" }, { write: () => {} }, (error, tags) =>
        reports.push({ error, tags }),
      ),
      mountRoutes: (app) => {
        app.get("/boom", () => {
          throw new Error("contoh error api");
        });
        app.get("/limit", () => {
          throw new AppError("PLAN_LIMIT_REACHED");
        });
      },
    });
    const response = await request(app).get("/boom");
    await request(app).get("/limit");
    expect(reports).toHaveLength(1);
    expect(reports[0]?.error).toMatchObject({ message: "contoh error api" });
    expect(reports[0]?.tags).toMatchObject({ request_id: response.headers["x-request-id"] });
  });

  it("rute tidak dikenal → 404 NOT_FOUND dengan envelope", async () => {
    const response = await request(setup().app).get("/tidak-ada");
    expect(response.status).toBe(404);
    expect(ErrorBodySchema.parse(response.body).error.code).toBe("NOT_FOUND");
  });

  it("Accept-Language: en → pesan Inggris; bahasa tak didukung → Indonesia", async () => {
    const { app } = setup();
    expect((await request(app).get("/tidak-ada").set("accept-language", "en-US,en;q=0.9")).body.error.message).toBe(
      "The requested data was not found.",
    );
    expect((await request(app).get("/tidak-ada").set("accept-language", "fr")).body.error.message).toBe(
      "Data yang dicari tidak ditemukan.",
    );
  });

  it("body parser: JSON rusak → 422 invalid_json; terlalu besar → 413 PAYLOAD_TOO_LARGE", async () => {
    const { app, reportError } = setup();
    const broken = await request(app).post("/json").set("content-type", "application/json").send('{"a":');
    expect(broken.status).toBe(422);
    expect(broken.body.error.details.issues[0].code).toBe("invalid_json");
    const big = await request(app)
      .post("/json")
      .set("content-type", "application/json")
      .send(`{"x":"${"a".repeat(1_100_000)}"}`);
    expect([big.status, big.body.error.code]).toEqual([413, "PAYLOAD_TOO_LARGE"]);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("RATE_LIMITED → header Retry-After (dibulatkan ke atas)", async () => {
    const response = await request(setup().app).get("/slow-down");
    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("13");
  });

  it("setiap kode katalog punya pesan ID & EN", () => {
    for (const code of Object.keys(ERROR_STATUS)) {
      for (const locale of LOCALES) expect(hasMessage(locale, "errors", code), `${locale}:${code}`).toBe(true);
    }
  });
});
