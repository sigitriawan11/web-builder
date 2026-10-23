import type { CommandResult } from "@platform/document-model";
import { ToolError, type ToolErrorCode } from "../errors";

// AI-061: tool mutation menjalankan command API di draft; error command → ToolError terbaca model. Satu tool call =
// satu command (atomic). Pemetaan kode command (DM) → kode tool (AI-060).

const COMMAND_TO_TOOL: Record<string, ToolErrorCode> = {
  INVALID_INPUT: "INVALID_INPUT",
  NOT_FOUND: "NOT_FOUND",
  INVALID_TARGET: "CONSTRAINT_VIOLATION",
  CYCLE: "CONSTRAINT_VIOLATION",
  INVALID_RESULT: "CONSTRAINT_VIOLATION",
  INVARIANT_VIOLATION: "CONSTRAINT_VIOLATION",
  LIMIT_EXCEEDED: "CHANGE_LIMIT_REACHED",
  LOCKED: "LOCKED",
};

/** Lempar ToolError bila command gagal; kembalikan `value` + `affected` bila sukses. */
export function unwrapCommand<T>(result: CommandResult<T>): { value: T; affected: string[] } {
  if (result.ok) return { value: result.value, affected: result.affected };
  const code = COMMAND_TO_TOOL[result.error.code] ?? "CONSTRAINT_VIOLATION";
  throw new ToolError(code, result.error.message.en, {
    ...(result.error.details ? { details: result.error.details } : {}),
  });
}
