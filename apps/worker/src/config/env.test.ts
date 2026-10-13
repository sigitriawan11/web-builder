import { EnvError } from "@platform/shared/env";
import { describe, expect, it } from "vitest";
import { loadWorkerEnv } from "./env";

const base = { APP_ENV: "local", REDIS_URL: "redis://localhost:6379" };

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

  it("port health default 4200", () => {
    expect(loadWorkerEnv(base).WORKER_HEALTH_PORT).toBe(4200);
  });
});
