import { describe, expect, it } from "vitest";
import type { ModelClient, ModelTurn } from "./model-client";
import { RetryableModelError, withModelRetry } from "./model-client";
import { ModelRouter, parseModelConfig } from "./models";

// T3.13.7 (AI-047/AI-211): routing model + retry 429/529.

const okTurn: ModelTurn = { text: "ok", toolUses: [], stopReason: "end_turn" };

describe("withModelRetry (AI-211)", () => {
  it("529 tiga kali lalu sukses → sukses dengan 3 retry tercatat", async () => {
    let calls = 0;
    const retries: number[] = [];
    const client: ModelClient = {
      generate: () => {
        calls++;
        if (calls <= 3) throw new RetryableModelError(529, "overloaded");
        return Promise.resolve(okTurn);
      },
    };
    const wrapped = withModelRetry(client, {
      maxRetries: 3,
      sleep: () => Promise.resolve(),
      onRetry: (attempt) => retries.push(attempt),
    });
    const turn = await wrapped.generate({ messages: [], tools: [] });
    expect(turn.text).toBe("ok");
    expect(calls).toBe(4);
    expect(retries).toEqual([1, 2, 3]);
  });

  it("melebihi maxRetries → lempar error", async () => {
    const client: ModelClient = {
      generate: () => {
        throw new RetryableModelError(429, "rate limited");
      },
    };
    const wrapped = withModelRetry(client, { maxRetries: 2, sleep: () => Promise.resolve() });
    await expect(wrapped.generate({ messages: [], tools: [] })).rejects.toThrow(/rate limited/);
  });

  it("error non-retryable (400) langsung dilempar", async () => {
    const client: ModelClient = {
      generate: () => {
        throw new Error("bad request");
      },
    };
    const wrapped = withModelRetry(client, { maxRetries: 3, sleep: () => Promise.resolve() });
    await expect(wrapped.generate({ messages: [], tools: [] })).rejects.toThrow(/bad request/);
  });
});

describe("ModelRouter (AI-047)", () => {
  it("task → tier → model ID dari config (bukan hardcode)", () => {
    const config = parseModelConfig(JSON.stringify({ small: "m-s", medium: "m-m", large: "m-l" }));
    const router = new ModelRouter(config);
    expect(router.pick("plan")).toBe("large");
    expect(router.pick("classify")).toBe("small");
    expect(router.modelForTask("plan")).toBe("m-l");
    expect(router.modelForTask("inline")).toBe("m-s");
  });

  it("config invalid → error", () => {
    expect(() => parseModelConfig("{bukan json")).toThrow();
    expect(() => parseModelConfig(JSON.stringify({ small: "x" }))).toThrow();
  });
});
