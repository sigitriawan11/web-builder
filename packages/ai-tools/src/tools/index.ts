import { ToolRegistry } from "../registry";
import type { Tool } from "../tool";
import { searchComponents } from "./library";
import { insertComponent, setProp, updateNodeStyle, updateText } from "./mutation";
import { getNode, getPageTree } from "./read";

// T3.13.4: tool dasar Read + Library + Mutation (AI-061/AI-102). Daftar + registry siap-pakai untuk worker.

export { ADMIN_TOOLS, adminAddVariant, adminCreateComponentDraft } from "./admin";
export { searchComponents } from "./library";
export { insertComponent, setProp, updateNodeStyle, updateText } from "./mutation";
export type { AiToolPorts, LibrarySearchResult } from "./ports";
export { getNode, getPageTree } from "./read";

/** Semua tool dasar M3. Admin-only tools (T3.13.5) & render_preview (T3.13.10) didaftarkan terpisah. */
export const BASE_TOOLS: Tool[] = [
  getPageTree,
  getNode,
  searchComponents,
  insertComponent,
  updateNodeStyle,
  updateText,
  setProp,
];

/** Registry berisi tool dasar + tambahan opsional (admin, render). */
export function createToolRegistry(extra: Tool[] = []): ToolRegistry {
  return new ToolRegistry().register(...BASE_TOOLS, ...extra);
}
