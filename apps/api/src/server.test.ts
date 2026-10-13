import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { startServer } from "./server";
import { freePort } from "./test-utils";

const baseEnv = {
  NODE_ENV: "test" as const,
  APP_ENV: "staging" as const, // bukan local: tanpa pino-pretty agar log JSON
  LOG_LEVEL: "info" as const,
  // Pool pg baru membuka koneksi saat query pertama; health/live tidak menyentuh DB.
  DATABASE_URL: "postgres://platform:platform@127.0.0.1:1/unused",
  DATABASE_POOL_MAX: 2,
  // Redis sengaja tidak tersedia: server tetap start & shutdown rapi (rate limit pakai limiter cadangan).
  REDIS_URL: "redis://127.0.0.1:1",
  S3_ENDPOINT: "http://127.0.0.1:1",
  INTERNAL_JWT_SECRET: "test-internal-secret-0123456789abcdef",
  BETTER_AUTH_SECRET: "test-better-auth-secret-0123456789abcdef",
  BETTER_AUTH_URL: "http://app.localhost:3000/api/auth",
  PUBLIC_APP_URL: "http://app.localhost:3000",
};

describe("server & graceful shutdown (T1.4.1)", () => {
  it("close() menghentikan listener; dipanggil berulang aman", async () => {
    const port = await freePort();
    const running = await startServer({ ...baseEnv, API_PORT: port }, { redisConnectTimeoutMs: 100 });
    expect((await fetch(`http://127.0.0.1:${port}/health/live`)).status).toBe(200);
    await Promise.all([running.close("test"), running.close("test-lagi")]);
    expect(running.server.listening).toBe(false);
    await expect(fetch(`http://127.0.0.1:${port}/health/live`)).rejects.toThrow();
  });

  it("main.ts: SIGTERM → shutdown rapi, exit 0", async () => {
    const port = await freePort();
    const child = spawn(process.execPath, ["--import", "tsx", "src/main.ts"], {
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, ...baseEnv, API_PORT: String(port), DATABASE_POOL_MAX: "2" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));

    const deadline = Date.now() + 15_000;
    while (!output.includes("api listening")) {
      if (Date.now() > deadline) throw new Error(`api tidak start:\n${output}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect((await fetch(`http://127.0.0.1:${port}/health/live`)).status).toBe(200);

    child.kill("SIGTERM");
    expect(await exited).toBe(0);
    expect(output).toContain("api shutdown dimulai");
    expect(output).toContain("api shutdown selesai");
  }, 30_000);
});
