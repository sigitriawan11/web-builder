import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolError } from "./errors";
import { ToolRegistry } from "./registry";
import { defineTool, type ToolContext } from "./tool";

// T3.13.1 (AI-060/AI-102): kerangka tool — validasi Zod, error terbaca model, registry per mode, JSON Schema.

const ctx = {} as ToolContext;

const echo = defineTool({
  name: "echo",
  description: "Echo text back.",
  input: z.object({ text: z.string().min(1).max(10) }),
  output: z.object({ text: z.string() }),
  modes: ["user", "admin_library"],
  mutating: false,
  handler: (_ctx, input) => ({ text: input.text }),
});

const adminOnly = defineTool({
  name: "admin_only",
  description: "Admin tool.",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  modes: ["admin_library"],
  mutating: true,
  requires: { feature: "ai" },
  handler: () => ({ ok: true }),
});

const boom = defineTool({
  name: "boom",
  description: "Throws NOT_FOUND.",
  input: z.object({ id: z.string() }),
  output: z.object({}),
  modes: ["user"],
  mutating: false,
  handler: (_ctx, input) => {
    throw new ToolError("NOT_FOUND", `node '${input.id}' not found`);
  },
});

describe("defineTool (AI-060/AI-102)", () => {
  it("sukses: input valid → output", async () => {
    const res = await echo.run(ctx, { text: "hi" });
    expect(res).toEqual({ ok: true, output: { text: "hi" } });
  });

  it("INVALID_INPUT: Zod gagal → issues per field (tak throw)", async () => {
    const res = await echo.run(ctx, { text: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("INVALID_INPUT");
      expect((res.error.details?.issues as string[] | undefined)?.join() ?? "").toContain("text");
      expect(res.error.hint).toBeTruthy();
    }
  });

  it("domain error: ToolError NOT_FOUND → payload + hint default", async () => {
    const res = await boom.run(ctx, { id: "n_x9" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("NOT_FOUND");
      expect(res.error.message).toContain("n_x9");
      expect(res.error.hint).toContain("read tool");
    }
  });
});

describe("ToolRegistry (AI-101)", () => {
  it("toolsFor menyaring per mode + entitlement", () => {
    const registry = new ToolRegistry().register(echo, adminOnly, boom);
    // user tanpa fitur: echo + boom (admin_only butuh mode admin).
    expect(
      registry
        .toolsFor({ mode: "user" })
        .map((t) => t.name)
        .sort(),
    ).toEqual(["boom", "echo"]);
    // admin tanpa fitur `ai`: admin_only tersaring (butuh fitur).
    expect(registry.toolsFor({ mode: "admin_library" }).map((t) => t.name)).toEqual(["echo"]);
    // admin dengan fitur `ai`: admin_only tersedia.
    expect(
      registry
        .toolsFor({ mode: "admin_library", entitlements: new Set(["ai"]) })
        .map((t) => t.name)
        .sort(),
    ).toEqual(["admin_only", "echo"]);
  });

  it("register duplikat → error", () => {
    expect(() => new ToolRegistry().register(echo, echo)).toThrow(/duplikat/);
  });

  it("toJsonSchemas → definisi Claude API (name/description/input_schema)", () => {
    const schemas = ToolRegistry.toJsonSchemas([echo]);
    expect(schemas[0]?.name).toBe("echo");
    expect(schemas[0]?.input_schema).toMatchObject({ type: "object" });
    const schema0 = schemas[0]?.input_schema as { properties: Record<string, unknown> } | undefined;
    expect(schema0?.properties).toHaveProperty("text");
  });
});
