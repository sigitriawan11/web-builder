import type { ToolJsonSchema } from "./registry";

// AI-211: interface klien model + wrapper retry/fallback. Bentuk pesan/tool mengikuti Anthropic Messages API (content
// block text/tool_use/tool_result) agar klien nyata (apps/worker) memetakan langsung. ai-tools TETAP tanpa network —
// HTTP call ada di worker; wrapper retry di sini generik (menerima klien yang di-inject).

export interface ModelToolUse {
  id: string;
  name: string;
  input: unknown;
}
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}
export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";

export interface ModelTurn {
  text: string;
  toolUses: ModelToolUse[];
  stopReason: StopReason;
  usage?: ModelUsage;
  // Model aktual yang menjawab (bisa fallback, AI-211). Diisi klien nyata.
  modelId?: string;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface ModelMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface ModelRequest {
  system?: string;
  messages: ModelMessage[];
  tools: ToolJsonSchema[];
  model?: string;
  maxTokens?: number;
}

export interface ModelClient {
  generate(request: ModelRequest): Promise<ModelTurn>;
}

// Error yang boleh di-retry (AI-211): 429 (rate limit) & 529 (overloaded). Klien nyata melemparnya pada status itu.
export class RetryableModelError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RetryableModelError";
  }
}

export interface RetryOptions {
  maxRetries?: number;
  backoffMs?: (attempt: number) => number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: RetryableModelError) => void;
}

// ai-tools tanpa lib DOM/node → akses setTimeout lewat globalThis (sleep nyata di-inject worker bila perlu presisi).
const defaultSleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => {
    (globalThis as unknown as { setTimeout: (cb: () => void, ms: number) => unknown }).setTimeout(() => resolve(), ms);
  });

/** Bungkus klien model dengan retry eksponensial pada 429/529 (AI-211). `onRetry` mencatat tiap retry ke run. */
export function withModelRetry(client: ModelClient, options: RetryOptions = {}): ModelClient {
  const maxRetries = options.maxRetries ?? 3;
  const sleep = options.sleep ?? defaultSleep;
  const backoff = options.backoffMs ?? ((attempt) => 2 ** (attempt - 1) * 500);
  return {
    async generate(request) {
      let attempt = 0;
      for (;;) {
        try {
          return await client.generate(request);
        } catch (error) {
          const retryable = error instanceof RetryableModelError && (error.status === 429 || error.status === 529);
          if (!retryable || attempt >= maxRetries) throw error;
          attempt++;
          options.onRetry?.(attempt, error as RetryableModelError);
          await sleep(backoff(attempt));
        }
      }
    },
  };
}
