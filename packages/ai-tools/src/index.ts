// @platform/ai-tools: Tool AI (Zod → JSON Schema) di atas ops document-model, skills, prompt, context builder; tanpa
// akses DB/network langsung (ARCHITECTURE §4.2). Efek samping lewat `ports` yang di-inject worker/api.

export { estimateTokens, toOutline } from "./context/outline";
export { DraftSession } from "./draft/draft-store";
export { TOOL_ERROR_CODES, ToolError, type ToolErrorCode, type ToolErrorPayload } from "./errors";
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
