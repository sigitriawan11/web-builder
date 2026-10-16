import type { ToolId } from "../../tools/tool-store";

// ED-037: tool pembuat node (menggambar di canvas). Dipisah dari use-create-tool agar bisa diimpor tanpa modul DOM.
export const CREATOR_TOOL_IDS = [
  "frame",
  "section",
  "rectangle",
  "ellipse",
  "text",
  "icon",
] as const satisfies readonly ToolId[];

const CREATOR_SET = new Set<ToolId>(CREATOR_TOOL_IDS);
export const isCreatorTool = (tool: ToolId): boolean => CREATOR_SET.has(tool);
