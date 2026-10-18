import { EnvError } from "@platform/shared/env";
import { describe, expect, it } from "vitest";
import { loadWorkerEnv } from "./env";

const base = {
  APP_ENV: "local",
  REDIS_URL: "redis://localhost:6379",
  DATABASE_URL: "postgres://platform:platform@localhost:5432/platform_dev",
  SMTP_URL: "smtp://localhost:1025",
  EMAIL_FROM: "Platform <no-reply@platformmu.com>",
  PUBLIC_APP_URL: "http://app.localhost:3000",
  S3_ENDPOINT: "http://localhost:9000",
  S3_ACCESS_KEY_ID: "minioadmin",
  S3_SECRET_ACCESS_KEY: "minioadmin",
};

describe("env worker", () => {
  it.each([
    [undefined, "all"],
    ["*", "all"],
    ["", "all"],
    ["email, publish,email", ["email", "publish"]],
  ])("WORKER_QUEUES=%s → %j", (value, expected) => {
    expect(loadWorkerEnv({ ...base, WORKER_QUEUES: value }).WORKER_QUEUES).toEqual(expected);
  });

  it("queue tidak dikenal → gagal start dengan nama queue", () => {
    expect(() => loadWorkerEnv({ ...base, WORKER_QUEUES: "email,emial" })).toThrow(EnvError);
    expect(() => loadWorkerEnv({ ...base, WORKER_QUEUES: "email,emial" })).toThrow(/emial/);
  });

  it("kredensial provider email yang dipilih wajib ada", () => {
    expect(() => loadWorkerEnv({ ...base, SMTP_URL: "" })).toThrow(/SMTP_URL: wajib diisi bila EMAIL_PROVIDER=smtp/);
    expect(() => loadWorkerEnv({ ...base, EMAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
    expect(loadWorkerEnv({ ...base, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_12345678" }).EMAIL_PROVIDER).toBe(
      "resend",
    );
  });

  it("port health default 4200", () => {
    expect(loadWorkerEnv(base).WORKER_HEALTH_PORT).toBe(4200);
  });
});
