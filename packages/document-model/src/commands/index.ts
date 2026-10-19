import { registerAsset, replaceText, setImage, setLink, setNodeProps, setTextContent } from "./content";
import { createNode } from "./create-node";
import { deleteNodes } from "./delete-nodes";
import { groupNodes, ungroup } from "./group";
import { createInstance, resetOverride, setInstanceOverride, setProp, setSlotContent, setVariant } from "./instance";
import { moveNode } from "./move-node";
import { renameNode, reorderNode, setHtmlId, setLocked, setTag, setVisible } from "./node-fields";
import { createPage, deletePage, reorderPages, updatePage } from "./pages";
import { clearBreakpointOverrides, setBreakpointOverride, setLayoutMode, setSettings } from "./style-commands";
import { duplicateNodes, insertSubtree } from "./subtree";
import { addFont, applyThemePreset, deleteToken, renameToken, setToken } from "./theme";
import { updateStyle } from "./update-style";
import { wrapInFrame } from "./wrap-in-frame";

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
  addFont,
  applyThemePreset,
  clearBreakpointOverrides,
  createInstance,
  createNode,
  createPage,
  deleteNodes,
  deletePage,
  duplicateNodes,
  groupNodes,
  insertSubtree,
  moveNode,
  registerAsset,
  renameNode,
  reorderNode,
  reorderPages,
  replaceText,
  resetOverride,
  setBreakpointOverride,
  setHtmlId,
  setImage,
  setInstanceOverride,
  setLayoutMode,
  setLink,
  setLocked,
  setNodeProps,
  setProp,
  setSettings,
  setSlotContent,
  setTag,
  setTextContent,
  setVariant,
  setVisible,
  ungroup,
  updatePage,
  updateStyle,
  wrapInFrame,
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
  registerAsset,
  replaceText,
  setImage,
  setLink,
  setHtmlId,
  setNodeProps,
  createPage,
  updatePage,
  reorderPages,
  deletePage,
  setToken,
  renameToken,
  deleteToken,
  addFont,
  applyThemePreset,
  createInstance,
  setProp,
  setVariant,
  setInstanceOverride,
  resetOverride,
  setSlotContent,
} as const;
