import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EnvError, envField, parseEnv } from "./env";

const schema = {
  DATABASE_URL: envField.url(),
  API_PORT: envField.port().default(4000),
  RATE_LIMIT_ENABLED: envField.boolean().default(true),
  BETTER_AUTH_SECRET: envField.secret(32),
  SENTRY_DSN: envField.url().optional(),
  WORKER_QUEUES: envField.list(),
  AI_MODEL_CONFIG: envField.json(z.object({ plan: z.string(), edit: z.string() })),
};

const valid = {
  DATABASE_URL: "postgres://platform:platform@localhost:5432/platform_dev",
  BETTER_AUTH_SECRET: "x".repeat(32),
  WORKER_QUEUES: "publish, thumbnails,,",
  AI_MODEL_CONFIG: '{"plan":"model-a","edit":"model-b"}',
  UNRELATED_KEY: "diabaikan",
};

function issuesOf(source: Record<string, string>): EnvError["issues"] {
  try {
    parseEnv("api", schema, source);
  } catch (error) {
    if (error instanceof EnvError) return error.issues;
    throw error;
  }
  throw new Error("seharusnya gagal");
}

describe("parseEnv (ARCHITECTURE §15.4)", () => {
  it("mengonversi tipe & mengisi default", () => {
    expect(parseEnv("api", schema, valid)).toEqual({
      DATABASE_URL: valid.DATABASE_URL,
      API_PORT: 4000,
      RATE_LIMIT_ENABLED: true,
      BETTER_AUTH_SECRET: valid.BETTER_AUTH_SECRET,
      WORKER_QUEUES: ["publish", "thumbnails"],
      AI_MODEL_CONFIG: { plan: "model-a", edit: "model-b" },
    });
  });

  it("string kosong (`KEY=`) dianggap tidak diisi: optional/default berlaku, wajib → error", () => {
    const parsed = parseEnv("api", schema, { ...valid, SENTRY_DSN: "", API_PORT: "" });
    expect(parsed.SENTRY_DSN).toBeUndefined();
    expect(parsed.API_PORT).toBe(4000);
    expect(issuesOf({ ...valid, DATABASE_URL: "" })).toEqual([{ key: "DATABASE_URL", message: "wajib diisi" }]);
  });

  it("melaporkan SEMUA variabel bermasalah sekaligus dengan nama app", () => {
    const { DATABASE_URL: _omit, ...withoutDb } = valid;
    let error: unknown;
    try {
      parseEnv("api", schema, {
        ...withoutDb,
        API_PORT: "99999",
        RATE_LIMIT_ENABLED: "yes",
        AI_MODEL_CONFIG: "{rusak",
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(EnvError);
    const message = (error as EnvError).message;
    expect(message).toContain('Konfigurasi env "api" tidak valid (4 variabel)');
    for (const key of ["DATABASE_URL", "API_PORT", "RATE_LIMIT_ENABLED", "AI_MODEL_CONFIG"])
      expect(message).toContain(key);
    expect(message).toContain("bukan JSON valid");
  });

  it("nilai env (bisa secret) tidak pernah muncul di pesan error", () => {
    const secret = "rahasia-pendek";
    const message = issuesOf({ ...valid, BETTER_AUTH_SECRET: secret, DATABASE_URL: "bukan-url-rahasia" })
      .map((issue) => issue.message)
      .join("\n");
    expect(message).not.toContain(secret);
    expect(message).not.toContain("bukan-url-rahasia");
    expect(message).toContain("minimal 32 karakter");
  });

  it("menerima sumber non-Node (import.meta.env Vite berisi boolean)", () => {
    expect(parseEnv("editor", { VITE_API_BASE: envField.string() }, { VITE_API_BASE: "/api", DEV: true })).toEqual({
      VITE_API_BASE: "/api",
    });
  });
});
