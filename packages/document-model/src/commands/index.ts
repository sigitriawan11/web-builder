import { replaceText, setImage, setLink, setNodeProps, setTextContent } from "./content";
import { createNode } from "./create-node";
import { deleteNodes } from "./delete-nodes";
import { moveNode } from "./move-node";
import { renameNode, reorderNode, setLocked, setTag, setVisible } from "./node-fields";
import { createPage, deletePage, reorderPages, updatePage } from "./pages";
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
export { plainToRichText } from "./content";
export { type Subtree, SubtreeSchema } from "./subtree";
export {
  clearBreakpointOverrides,
  createNode,
  createPage,
  deleteNodes,
  deletePage,
  duplicateNodes,
  insertSubtree,
  moveNode,
  renameNode,
  reorderNode,
  reorderPages,
  replaceText,
  setBreakpointOverride,
  setImage,
  setLayoutMode,
  setLink,
  setLocked,
  setNodeProps,
  setSettings,
  setTag,
  setTextContent,
  setVisible,
  updatePage,
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
  setTextContent,
  replaceText,
  setImage,
  setLink,
  setNodeProps,
  createPage,
  updatePage,
  reorderPages,
  deletePage,
} as const;
