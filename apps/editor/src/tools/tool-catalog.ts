import type { Shortcut } from "../app/chrome/shortcut";
import type { ToolId } from "./tool-store";

// ED-006 / tabel shortcut §25: tool toolbar beserta shortcut. Rectangle/Ellipse/Line dikelompokkan "Shape".
export interface ToolDefinition {
  id: ToolId;
  shortcuts: readonly Shortcut[];
  group?: "shape";
}

export const TOOLS: readonly ToolDefinition[] = [
  { id: "select", shortcuts: [{ code: "KeyV" }] },
  { id: "frame", shortcuts: [{ code: "KeyF" }, { code: "KeyA" }] },
  { id: "section", shortcuts: [{ code: "KeyS", shift: true }] },
  { id: "rectangle", shortcuts: [{ code: "KeyR" }], group: "shape" },
  { id: "ellipse", shortcuts: [{ code: "KeyO" }], group: "shape" },
  { id: "line", shortcuts: [{ code: "KeyL" }], group: "shape" },
  { id: "text", shortcuts: [{ code: "KeyT" }] },
  { id: "image", shortcuts: [{ code: "KeyK", shift: true, mod: true }] },
  { id: "icon", shortcuts: [{ code: "KeyI", shift: true }] },
  { id: "hand", shortcuts: [{ code: "KeyH" }] },
];

export const toolDefinition = (id: ToolId): ToolDefinition => {
  const found = TOOLS.find((tool) => tool.id === id);
  if (!found) throw new Error(`tool ${id} tidak terdaftar`);
  return found;
};
