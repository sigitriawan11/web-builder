import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../app";
import { silentLogger } from "../test-utils";
import { validated } from "./validate";

const schemas = {
  params: z.object({ siteId: z.uuid() }),
  query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
  body: z.object({ name: z.string().trim().min(1).max(80), password: z.string().min(8).optional() }),
};

function app() {
  return createApp({
    logger: silentLogger(),
    mountRoutes: (app) => {
      const router = express.Router();
      router.patch(
        "/sites/:siteId",
        ...validated(schemas, (req, res) => {
          // Tipe dari schema: limit number, name string (sudah di-trim).
          const limit: number = req.valid.query.limit;
          const name: string = req.valid.body.name;
          res.json({ siteId: req.valid.params.siteId, limit, name });
        }),
      );
      app.use(router);
    },
  });
}

const SITE = "01990000-0000-7000-8000-000000000201";

describe("validate (middleware 10)", () => {
  it("input valid → handler menerima nilai hasil parse (coerce, default, trim)", async () => {
    const response = await request(app()).patch(`/sites/${SITE}?limit=50`).send({ name: "  Toko Budi  " });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ siteId: SITE, limit: 50, name: "Toko Budi" });
    expect((await request(app()).patch(`/sites/${SITE}`).send({ name: "x" })).body.limit).toBe(20);
  });

  it("body invalid → 422 VALIDATION_FAILED + details.issues per lokasi & path", async () => {
    const response = await request(app()).patch(`/sites/${SITE}`).send({ name: "", password: "pendek-" });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
    expect(response.body.error.details.issues).toEqual([
      expect.objectContaining({ location: "body", path: "name", code: "too_small" }),
      expect.objectContaining({ location: "body", path: "password", code: "too_small" }),
    ]);
  });

  it("semua lokasi dilaporkan sekaligus (params, query, body)", async () => {
    const response = await request(app()).patch("/sites/bukan-uuid?limit=999").send({});
    expect(response.status).toBe(422);
    expect(response.body.error.details.issues.map((issue: { location: string }) => issue.location)).toEqual([
      "params",
      "query",
      "body",
    ]);
  });

  it("issue tidak memuat nilai input (bisa berisi secret)", async () => {
    const response = await request(app()).patch(`/sites/${SITE}`).send({ name: "ok", password: "rahasia" });
    expect(JSON.stringify(response.body)).not.toContain("rahasia");
  });

  it("type test: req.valid bertipe dari schema (dicek tsc -b)", () => {
    const handlers = validated(schemas, (req) => {
      // @ts-expect-error limit bertipe number, bukan string.
      const wrong: string = req.valid.query.limit;
      // @ts-expect-error field yang tidak ada di schema body.
      void req.valid.body.unknownField;
      return wrong;
    });
    expect(handlers).toHaveLength(2);
  });
});
