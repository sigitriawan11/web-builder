import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { silentLogger } from "./test-utils";

describe("createApp (ARCHITECTURE §5.3)", () => {
  it("GET /health/live → 200 { status: ok }", async () => {
    const response = await request(createApp({ logger: silentLogger() })).get("/health/live");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("tidak membocorkan teknologi server (x-powered-by)", async () => {
    const response = await request(createApp({ logger: silentLogger() })).get("/health/live");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});
