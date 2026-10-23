import { RetryableModelError } from "@platform/ai-tools";
import { describe, expect, it, vi } from "vitest";
import { createClaudeModelClient } from "./claude-client";

// T3.13.7: pemetaan request/response Claude (mock fetch; int test nyata = manual dgn API key dev).

function mockFetch(status: number, json: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    text: async () => JSON.stringify(json),
  })) as unknown as typeof fetch;
}

const anthropicOk = {
  content: [
    { type: "text", text: "Hello" },
    { type: "tool_use", id: "tu_1", name: "ping", input: { msg: "hi" } },
  ],
  stop_reason: "tool_use",
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 },
};

describe("createClaudeModelClient (T3.13.7)", () => {
  it("map response Anthropic → ModelTurn (text + tool_use + usage)", async () => {
    const fetchImpl = mockFetch(200, anthropicOk);
    const client = createClaudeModelClient({ apiKey: "sk-test", model: "claude-x", fetchImpl });
    const turn = await client.generate({
      messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      tools: [],
    });
    expect(turn.text).toBe("Hello");
    expect(turn.toolUses).toEqual([{ id: "tu_1", name: "ping", input: { msg: "hi" } }]);
    expect(turn.stopReason).toBe("tool_use");
    expect(turn.usage).toMatchObject({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 2 });
    expect(turn.modelId).toBe("claude-x");
  });

  it("kirim body benar (model, system, tools, header x-api-key)", async () => {
    const fetchImpl = mockFetch(200, { content: [], stop_reason: "end_turn" });
    const client = createClaudeModelClient({ apiKey: "sk-test", model: "claude-x", fetchImpl });
    await client.generate({
      system: "You are helpful",
      messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      tools: [{ name: "ping", description: "d", input_schema: { type: "object" } }],
    });
    const call = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const init = call?.[1] as { headers: Record<string, string>; body: string };
    expect(init.headers["x-api-key"]).toBe("sk-test");
    const body = JSON.parse(init.body) as { model: string; system: string; tools: unknown[] };
    expect(body.model).toBe("claude-x");
    expect(body.system).toBe("You are helpful");
    expect(body.tools).toHaveLength(1);
  });

  it("429 → RetryableModelError; 400 → Error biasa", async () => {
    const c429 = createClaudeModelClient({ apiKey: "k", model: "m", fetchImpl: mockFetch(429, { error: "rate" }) });
    await expect(c429.generate({ messages: [], tools: [] })).rejects.toBeInstanceOf(RetryableModelError);
    const c400 = createClaudeModelClient({ apiKey: "k", model: "m", fetchImpl: mockFetch(400, { error: "bad" }) });
    await expect(c400.generate({ messages: [], tools: [] })).rejects.toThrow(/Anthropic error 400/);
  });
});
