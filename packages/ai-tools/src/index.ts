// @platform/ai-tools: Tool AI (Zod → JSON Schema) di atas ops document-model, skills, prompt, context builder; tanpa
// akses DB/network langsung (ARCHITECTURE §4.2). Efek samping lewat `ports` yang di-inject worker/api.

export { budgetFor, GLOBAL_RUN_LIMITS, RUN_BUDGETS, type RunBudget, type RunKind } from "./budgets";
export { estimateTokens, toOutline } from "./context/outline";
export { DraftSession } from "./draft/draft-store";
export { TOOL_ERROR_CODES, ToolError, type ToolErrorCode, type ToolErrorPayload } from "./errors";
export {
  type ContentBlock,
  type ModelClient,
  type ModelMessage,
  type ModelRequest,
  type ModelToolUse,
  type ModelTurn,
  type ModelUsage,
  RetryableModelError,
  type RetryOptions,
  type StopReason,
  withModelRetry,
} from "./model-client";
export {
  type ModelConfig,
  ModelConfigSchema,
  ModelRouter,
  type ModelTask,
  type ModelTier,
  ModelTierSchema,
  parseModelConfig,
} from "./models";
export { type ToolJsonSchema, ToolRegistry } from "./registry";
export {
  defineTool,
  type Tool,
  type ToolContext,
  type ToolDef,
  type ToolMode,
  type ToolPorts,
  type ToolResult,
} from "./tool";
export * from "./tools";
