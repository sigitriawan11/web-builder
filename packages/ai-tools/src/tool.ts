import type { CommandContext } from "@platform/document-model";
import type { z } from "zod";
import { ToolError, type ToolErrorPayload } from "./errors";

// AI-060/AI-061/AI-102: kerangka tool AI. Tiap tool = schema Zod (input/output) + handler murni di atas ops
// document-model (mutation lewat command API, bukan Y.Map langsung). Framework memvalidasi input dengan Zod dan
// membungkus error jadi payload yang terbaca model. Tool TIDAK mengakses DB/network langsung — lewat `ports`.

// Mode run menentukan tool mana yang tersedia (AI-101 registry per mode).
export type ToolMode = "user" | "admin_library" | "dynamic" | "commerce";

// Port efek-samping yang di-inject worker/api (library search, render, asset). ai-tools tetap murni (ARCHITECTURE §4.2).
// Dibiarkan terbuka; tiap tool mendeklarasikan port yang dibutuhkannya lewat `ctx.ports`.
export type ToolPorts = Record<string, unknown>;

export interface ToolContext {
  // Command context document-model (berjalan di draft Y.Doc dengan origin `ai:<runId>`); mutation via runCommand.
  commandCtx: CommandContext;
  // Snapshot JSON dokumen untuk tool read (tanpa menyentuh Y.Doc langsung di tools/**).
  readDocument: () => unknown;
  mode: ToolMode;
  runId: string;
  ports: ToolPorts;
}

export interface ToolDef<I extends z.ZodType, O extends z.ZodType> {
  name: string;
  description: string;
  input: I;
  output: O;
  // Mode yang boleh memakai tool ini (AI-101).
  modes: readonly ToolMode[];
  // Tool read-only vs mengubah dokumen (AI untuk UI & budget perubahan).
  mutating: boolean;
  // Entitlement/fitur paket yang dibutuhkan (dicek registry/worker sebelum menawarkan tool).
  requires?: { feature?: string };
  handler: (ctx: ToolContext, input: z.infer<I>) => z.infer<O> | Promise<z.infer<O>>;
}

export type ToolResult<O> = { ok: true; output: O } | { ok: false; error: ToolErrorPayload };

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly modes: readonly ToolMode[];
  readonly mutating: boolean;
  readonly requires?: { feature?: string };
  readonly inputSchema: z.ZodType;
  // Validasi Zod (AI-102) → handler → ToolResult. Tidak pernah throw; error jadi payload terbaca model.
  run(ctx: ToolContext, rawInput: unknown): Promise<ToolResult<unknown>>;
}

/** Format issue Zod → `path: message` (AI-060: daftar issue agar model memperbaiki field spesifik). */
function formatIssues(error: z.ZodError): { issues: string[] } {
  return { issues: error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`) };
}

export function defineTool<I extends z.ZodType, O extends z.ZodType>(def: ToolDef<I, O>): Tool {
  return {
    name: def.name,
    description: def.description,
    modes: def.modes,
    mutating: def.mutating,
    ...(def.requires ? { requires: def.requires } : {}),
    inputSchema: def.input,
    async run(ctx, rawInput) {
      const parsed = def.input.safeParse(rawInput);
      if (!parsed.success) {
        const error = new ToolError("INVALID_INPUT", `Invalid input for ${def.name}.`, {
          details: formatIssues(parsed.error),
        });
        return { ok: false, error: error.toPayload() };
      }
      try {
        const output = await def.handler(ctx, parsed.data);
        return { ok: true, output };
      } catch (error) {
        if (error instanceof ToolError) return { ok: false, error: error.toPayload() };
        // Error tak terduga → UPSTREAM_ERROR (jangan bocorkan stack ke model).
        return {
          ok: false,
          error: new ToolError("UPSTREAM_ERROR", `Tool ${def.name} failed unexpectedly.`).toPayload(),
        };
      }
    },
  };
}
