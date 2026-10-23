import { defineTool, type ToolContext, ToolRegistry } from "@platform/ai-tools";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgent } from "./agent-runner";
import type { ModelClient, ModelRequest, ModelTurn } from "./model";

// T3.13.6 (AI-040/041/042): loop AgentRunner dengan model mock. Loop SELALU berakhir; tiap tool_use → satu tool_result.

const ping = defineTool({
  name: "ping",
  description: "Ping.",
  input: z.object({ msg: z.string() }),
  output: z.object({ pong: z.string() }),
  modes: ["user"],
  mutating: false,
  handler: (_ctx, input) => ({ pong: input.msg }),
});

const touch = defineTool({
  name: "touch",
  description: "Mutating no-op.",
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  modes: ["user"],
  mutating: true,
  handler: () => ({ ok: true }),
});

/** Model mock: memutar skrip giliran; bila skrip habis, ulangi giliran terakhir (mis. selalu tool_use). */
function scriptedModel(turns: ModelTurn[]): ModelClient & { calls: ModelRequest[] } {
  const calls: ModelRequest[] = [];
  let i = 0;
  return {
    calls,
    generate(request: ModelRequest) {
      calls.push(request);
      const turn = turns[Math.min(i, turns.length - 1)];
      i++;
      return Promise.resolve(turn as ModelTurn);
    },
  };
}

const toolUse = (id: string, name: string, input: unknown): ModelTurn => ({
  text: "",
  toolUses: [{ id, name, input }],
  stopReason: "tool_use",
});
const endTurn = (text: string): ModelTurn => ({ text, toolUses: [], stopReason: "end_turn" });

const budget = { maxIterations: 6, maxTimeMs: 60_000, maxCommands: 2, maxRenders: 1 };
const ctx = {} as ToolContext;

describe("runAgent (AI-040/041/042)", () => {
  it("panggil tool lalu finish (end_turn) → completed, tool_result diumpankan", async () => {
    const model = scriptedModel([toolUse("t1", "ping", { msg: "hi" }), endTurn("Done.")]);
    const registry = new ToolRegistry().register(ping);
    const res = await runAgent({ model, registry, ctx, mode: "user", budget, userText: "do it" });
    expect(res.status).toBe("completed");
    expect(res.toolCalls).toBe(1);
    expect(res.finalText).toBe("Done.");
    // Panggilan model ke-2 menerima tool_result untuk t1.
    const secondCall = model.calls[1];
    const lastMsg = secondCall?.messages.at(-1);
    expect(lastMsg?.role).toBe("user");
    expect(lastMsg?.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
  });

  it("model yang TAK pernah finish → loop berakhir di maxIterations (AI-041)", async () => {
    const model = scriptedModel([toolUse("t", "ping", { msg: "x" })]); // selalu tool_use
    const registry = new ToolRegistry().register(ping);
    const res = await runAgent({ model, registry, ctx, mode: "user", budget, userText: "loop" });
    expect(res.status).toBe("budget_exhausted");
    expect(res.iterations).toBe(budget.maxIterations);
  });

  it("tool tak terdaftar → TOOL_NOT_AVAILABLE (loop lanjut)", async () => {
    const model = scriptedModel([toolUse("t1", "ghost_tool", {}), endTurn("ok")]);
    const registry = new ToolRegistry().register(ping);
    const res = await runAgent({ model, registry, ctx, mode: "user", budget, userText: "x" });
    expect(res.toolLog[0]).toMatchObject({ tool: "ghost_tool", status: "error", errorCode: "TOOL_NOT_AVAILABLE" });
    expect(res.status).toBe("completed");
  });

  it("maxCommands → CHANGE_LIMIT_REACHED utk mutation ke-3 (budget 2)", async () => {
    const model = scriptedModel([
      toolUse("a", "touch", {}),
      toolUse("b", "touch", {}),
      toolUse("c", "touch", {}),
      endTurn("done"),
    ]);
    const registry = new ToolRegistry().register(touch);
    const res = await runAgent({ model, registry, ctx, mode: "user", budget, userText: "spam" });
    expect(res.commands).toBe(2);
    expect(res.toolLog.filter((e) => e.errorCode === "CHANGE_LIMIT_REACHED")).toHaveLength(1);
  });

  it("budget waktu habis → loop berakhir", async () => {
    const model = scriptedModel([toolUse("t", "ping", { msg: "x" })]);
    const registry = new ToolRegistry().register(ping);
    let clock = 0;
    const res = await runAgent({
      model,
      registry,
      ctx,
      mode: "user",
      budget: { ...budget, maxIterations: 1000 },
      userText: "x",
      now: () => {
        clock += 20_000;
        return clock;
      },
    });
    expect(res.status).toBe("budget_exhausted");
    expect(res.iterations).toBeLessThan(1000);
  });
});
