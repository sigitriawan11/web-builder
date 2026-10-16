import { createStore } from "zustand/vanilla";

// ED-006: semua tool toolbar M2. Perilaku tool pembuat node (frame, section, shape, text, image, icon) di Epic 2.4,
// termasuk aturan "kembali ke Move setelah membuat node" (ED-037).
export const TOOL_IDS = [
  "select",
  "frame",
  "section",
  "rectangle",
  "ellipse",
  "line",
  "text",
  "image",
  "icon",
  "hand",
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export interface ToolState {
  // Tool yang dipilih user (toolbar / shortcut).
  active: ToolId;
  // Tool yang dipinjam selama tombol ditahan (mis. Space → hand); menang atas `active`.
  temporary: ToolId | null;
}

export type ToolAction =
  | { type: "selectTool"; tool: ToolId }
  | { type: "startTemporary"; tool: ToolId }
  | { type: "endTemporary"; tool: ToolId };

export const INITIAL_TOOL_STATE: ToolState = { active: "select", temporary: null };

export function effectiveTool(state: ToolState): ToolId {
  return state.temporary ?? state.active;
}

export function toolReducer(state: ToolState, action: ToolAction): ToolState {
  switch (action.type) {
    case "selectTool":
      return state.active === action.tool ? state : { ...state, active: action.tool };
    case "startTemporary":
      // Key repeat mengirim keydown berulang; tool sementara pertama yang berlaku.
      return state.temporary === null ? { ...state, temporary: action.tool } : state;
    case "endTemporary":
      // Hanya pemilik tool sementara yang boleh melepasnya.
      return state.temporary === action.tool ? { ...state, temporary: null } : state;
  }
}

interface ToolStoreState extends ToolState {
  dispatch(action: ToolAction): void;
}

export function createToolStore(initial: ToolState = INITIAL_TOOL_STATE) {
  return createStore<ToolStoreState>()((set, get) => ({
    ...initial,
    dispatch: (action) => {
      const current = get();
      const next = toolReducer({ active: current.active, temporary: current.temporary }, action);
      if (next.active !== current.active || next.temporary !== current.temporary) set(next);
    },
  }));
}

export const toolStore = createToolStore();
