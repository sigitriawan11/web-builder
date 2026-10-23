import type { ContentBlock, ModelClient, ModelRequest, ModelTurn, StopReason } from "@platform/ai-tools";
import { RetryableModelError } from "@platform/ai-tools";

// AI-047/AI-211/ARCHITECTURE §10.6: klien Claude Messages API (raw fetch — tanpa dependency SDK baru; mudah diganti
// @anthropic-ai/sdk nanti bila owner setuju). 429/529 → RetryableModelError (dibungkus `withModelRetry`). Model ID dari
// router (AI_MODEL_CONFIG), tidak di-hardcode. `apiKey` dari env worker.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface ClaudeClientOptions {
  apiKey: string;
  model: string;
  maxTokens?: number;
  baseUrl?: string;
  // Injectable untuk test (mock) — default global fetch.
  fetchImpl?: typeof fetch;
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  stop_reason: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

const STOP_MAP: Record<string, StopReason> = {
  end_turn: "end_turn",
  tool_use: "tool_use",
  max_tokens: "max_tokens",
  stop_sequence: "stop_sequence",
};

export function createClaudeModelClient(options: ClaudeClientOptions): ModelClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async generate(request: ModelRequest): Promise<ModelTurn> {
      const model = request.model ?? options.model;
      const body = {
        model,
        max_tokens: request.maxTokens ?? options.maxTokens ?? 4096,
        ...(request.system ? { system: request.system } : {}),
        messages: request.messages,
        ...(request.tools.length > 0 ? { tools: request.tools } : {}),
      };
      const response = await fetchImpl(options.baseUrl ?? ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": options.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        if (response.status === 429 || response.status === 529) {
          throw new RetryableModelError(response.status, `Anthropic ${response.status}: ${text.slice(0, 200)}`);
        }
        throw new Error(`Anthropic error ${response.status}: ${text.slice(0, 200)}`);
      }
      const data = (await response.json()) as AnthropicResponse;
      const text = data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");
      const toolUses = data.content
        .filter((block) => block.type === "tool_use")
        .map((block) => ({ id: block.id ?? "", name: block.name ?? "", input: block.input }));
      const turn: ModelTurn = {
        text,
        toolUses,
        stopReason: STOP_MAP[data.stop_reason ?? "end_turn"] ?? "end_turn",
        modelId: model,
      };
      if (data.usage) {
        turn.usage = {
          inputTokens: data.usage.input_tokens ?? 0,
          outputTokens: data.usage.output_tokens ?? 0,
          ...(data.usage.cache_read_input_tokens !== undefined
            ? { cacheReadTokens: data.usage.cache_read_input_tokens }
            : {}),
          ...(data.usage.cache_creation_input_tokens !== undefined
            ? { cacheWriteTokens: data.usage.cache_creation_input_tokens }
            : {}),
        };
      }
      return turn;
    },
  };
}

// Dummy content block re-export agar konsumen worker tak perlu impor dari dua tempat.
export type { ContentBlock };
