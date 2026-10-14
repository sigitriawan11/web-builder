import { createNode } from "./create-node";
import { deleteNodes } from "./delete-nodes";
import { moveNode } from "./move-node";
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
export { createNode, deleteNodes, moveNode, updateStyle };

/** Registry command (DM-073): sumber daftar tool AI (`aiExposed`) & dokumentasi. */
export const COMMANDS = { createNode, deleteNodes, moveNode, updateStyle } as const;
