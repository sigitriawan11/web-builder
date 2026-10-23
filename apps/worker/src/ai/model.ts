import type { ToolJsonSchema } from "@platform/ai-tools";

// Abstraksi klien model (Claude API nyata = T3.13.7; mock di test). Bentuk pesan/tool mengikuti Anthropic Messages API
// (content block: text + tool_use/tool_result) agar klien nyata bisa langsung memetakan.

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
}

// Content block Anthropic-style (text | tool_use | tool_result).
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
}

export interface ModelClient {
  generate(request: ModelRequest): Promise<ModelTurn>;
}
