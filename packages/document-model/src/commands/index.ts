import { createNode } from "./create-node";
import { deleteNodes } from "./delete-nodes";
import { moveNode } from "./move-node";
import { renameNode, reorderNode, setLocked, setTag, setVisible } from "./node-fields";
import { clearBreakpointOverrides, setBreakpointOverride, setLayoutMode, setSettings } from "./style-commands";
import { duplicateNodes, insertSubtree } from "./subtree";
import { updateStyle } from "./update-style";

export {
  type CommandContext,
  type CommandDef,
  type CommandError,
  type CommandErrorCode,
  type CommandResult,
  type CommandStep,
  defineCommand,
  runCommand,
  runCommands,
  step,
} from "./command";
export { type Subtree, SubtreeSchema } from "./subtree";
export {
  clearBreakpointOverrides,
  createNode,
  deleteNodes,
  duplicateNodes,
  insertSubtree,
  moveNode,
  renameNode,
  reorderNode,
  setBreakpointOverride,
  setLayoutMode,
  setLocked,
  setSettings,
  setTag,
  setVisible,
  updateStyle,
};

/** Registry command (DM-073): sumber daftar tool AI (`aiExposed`) & dokumentasi. */
export const COMMANDS = {
  createNode,
  insertSubtree,
  deleteNodes,
  duplicateNodes,
  moveNode,
  reorderNode,
  renameNode,
  setVisible,
  setLocked,
  setTag,
  updateStyle,
  setLayoutMode,
  setBreakpointOverride,
  clearBreakpointOverrides,
  setSettings,
} as const;
