import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { envField, parseEnv } from "../src/env";

describe(".env.example (ARCHITECTURE §15.4)", () => {
  it("memenuhi schema contoh — template yang disalin langsung bisa dipakai lokal", () => {
    const text = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
    const source = Object.fromEntries(
      text
        .split("\n")
        .map((line) => /^([A-Z0-9_]+)=(.*?)(?:\s+#.*)?$/.exec(line.trim()))
        .filter((match): match is RegExpExecArray => match !== null)
        .map(([, key, value]) => [key, (value ?? "").replace(/^"(.*)"$/, "$1")]),
    );
    const local = parseEnv(
      "contoh",
      {
        DATABASE_URL: envField.url(),
        DATABASE_URL_TEST: envField.url(),
        REDIS_URL: envField.url(),
        API_PORT: envField.port(),
        S3_FORCE_PATH_STYLE: envField.boolean(),
        RATE_LIMIT_ENABLED: envField.boolean(),
        POSTGRES_PORT: envField.port(),
        APP_ENV: z.enum(["local", "staging", "production"]),
      },
      source,
    );
    expect(local.APP_ENV).toBe("local");
  });
});
