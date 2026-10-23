import { defineTool, type ToolContext, ToolRegistry } from "@platform/ai-tools";
import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgent } from "./agent-runner";
import type { ModelClient, ModelTurn } from "./model";
import { persistRun } from "./run-persistence";

// T3.13.12 (AI-107/AI-160): Σ usage panggilan model = kolom agregat ai_runs; tiap tool call → ai_tool_calls.
let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

const ping = defineTool({
  name: "ping",
  description: "p",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  modes: ["admin_library"],
  mutating: false,
  handler: () => ({ ok: true }),
});

function model(turns: ModelTurn[]): ModelClient {
  let i = 0;
  return { generate: () => Promise.resolve(turns[Math.min(i++, turns.length - 1)] as ModelTurn) };
}

describe("persistRun (AI-107/AI-160)", () => {
  it("token diakumulasi ke ai_runs + tool call tercatat di ai_tool_calls", async () => {
    const [run] = await testDb.db
      .insert(schema.aiRuns)
      .values({ kind: "admin", status: "queued" })
      .returning({ id: schema.aiRuns.id });
    const runId = run?.id as string;

    const result = await runAgent({
      model: model([
        {
          text: "",
          toolUses: [{ id: "t1", name: "ping", input: {} }],
          stopReason: "tool_use",
          usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 1 },
        },
        { text: "Done.", toolUses: [], stopReason: "end_turn", usage: { inputTokens: 8, outputTokens: 3 } },
      ]),
      registry: new ToolRegistry().register(ping),
      ctx: {} as ToolContext,
      mode: "admin_library",
      budget: { maxIterations: 6, maxTimeMs: 60_000, maxCommands: 80, maxRenders: 1 },
      userText: "do",
    });
    // Σ usage = 18 input / 8 output.
    expect(result.usage).toEqual({ inputTokens: 18, outputTokens: 8, cacheReadTokens: 2, cacheWriteTokens: 1 });

    await persistRun(testDb.db, runId, result, { modelId: "claude-x" });

    const [row] = await testDb.db.select().from(schema.aiRuns).where(eq(schema.aiRuns.id, runId));
    expect(row?.status).toBe("completed");
    expect(row?.inputTokens).toBe(18);
    expect(row?.outputTokens).toBe(8);
    expect(row?.cacheReadTokens).toBe(2);
    expect(row?.toolCalls).toBe(1);
    expect(row?.iterations).toBe(2);
    expect(row?.modelId).toBe("claude-x");

    const calls = await testDb.db.select().from(schema.aiToolCalls).where(eq(schema.aiToolCalls.runId, runId));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ tool: "ping", status: "ok", seq: 0 });
  });
});
