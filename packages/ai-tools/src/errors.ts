// AI-060: error tool ditulis UNTUK model — kode stabil + pesan + hint cara memperbaiki. Mapping default hint agar
// model tahu langkah berikut (mis. panggil tool read). Kode selaras tabel spec 04 AI-060.

export const TOOL_ERROR_CODES = [
  "INVALID_INPUT",
  "NOT_FOUND",
  "OUT_OF_SCOPE",
  "CONSTRAINT_VIOLATION",
  "PROP_INVALID",
  "LOCKED",
  "CHANGE_LIMIT_REACHED",
  "PLAN_FEATURE_REQUIRED",
  "TOOL_NOT_AVAILABLE",
  "USER_DECLINED",
  "RATE_LIMITED",
  "UPSTREAM_ERROR",
  "MODERATION_BLOCKED",
] as const;
export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];

// Hint default per kode (bisa di-override per-throw dengan hint spesifik konteks).
const DEFAULT_HINTS: Record<ToolErrorCode, string> = {
  INVALID_INPUT: "Fix the fields listed under `issues` and call the tool again.",
  NOT_FOUND: "Call a read tool (e.g. get_page_tree or get_node) to obtain a valid ID.",
  OUT_OF_SCOPE: "Use ask_user to request expanding the selection scope.",
  CONSTRAINT_VIOLATION: "This violates a document-model rule; pick a valid target or structure.",
  PROP_INVALID: "Check the component props schema and send matching values.",
  LOCKED: "The node is locked; use set_prop or detach_instance instead.",
  CHANGE_LIMIT_REACHED: "The per-run change budget is exhausted; finish with a partial summary.",
  PLAN_FEATURE_REQUIRED: "This needs a higher plan; explain to the user and do not retry.",
  TOOL_NOT_AVAILABLE: "This tool is not registered for this run; do not call it again.",
  USER_DECLINED: "The user declined; find an alternative or finish.",
  RATE_LIMITED: "Upstream service is rate limited; retry once or skip.",
  UPSTREAM_ERROR: "An external service failed; retry once or skip.",
  MODERATION_BLOCKED: "Content violates policy; do not retry and explain politely to the user.",
};

export interface ToolErrorPayload {
  code: ToolErrorCode;
  message: string;
  hint: string;
  // Detail terstruktur (mis. daftar issue Zod) agar model bisa memperbaiki field spesifik.
  details?: Record<string, unknown>;
}

/** Error tool yang terbaca model. `hint` default dari kode kecuali di-override. */
export class ToolError extends Error {
  readonly code: ToolErrorCode;
  readonly hint: string;
  readonly details?: Record<string, unknown>;
  constructor(code: ToolErrorCode, message: string, opts: { hint?: string; details?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.hint = opts.hint ?? DEFAULT_HINTS[code];
    if (opts.details) this.details = opts.details;
  }
  toPayload(): ToolErrorPayload {
    return {
      code: this.code,
      message: this.message,
      hint: this.hint,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
