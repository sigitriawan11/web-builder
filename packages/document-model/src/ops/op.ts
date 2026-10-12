import type * as Y from "yjs";
import type { z } from "zod";
import type { IdPrefix } from "../ids";

export interface OpContext {
  doc: Y.Doc;
  // Origin transaksi; UndoManager hanya melacak origin milik session lokal (DM-060).
  origin?: unknown;
  idGen?: (prefix: IdPrefix) => string;
}

export type OpErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "INVALID_TARGET" | "CYCLE" | "INVALID_RESULT";

export interface OpIssue {
  code: OpErrorCode;
  message: string;
  path?: (string | number)[];
}

export type OpResult<T> = { ok: true; value: T; affected: string[] } | { ok: false; error: OpIssue };

// Kontrak `run`: periksa semua syarat SEBELUM menulis apa pun. Yjs tidak punya rollback,
// jadi op yang gagal tidak boleh meninggalkan perubahan parsial (DM-073).
export interface OpDef<I extends z.ZodType, O> {
  name: string;
  input: I;
  run(ctx: OpContext, input: z.infer<I>): OpResult<O>;
}

// Identitas saja; ada supaya tipe `input` di `run` diturunkan dari schema Zod-nya.
export function defineOp<I extends z.ZodType, O>(def: OpDef<I, O>): OpDef<I, O> {
  return def;
}

export function fail(code: OpErrorCode, message: string, path?: (string | number)[]): OpResult<never> {
  return { ok: false, error: path ? { code, message, path } : { code, message } };
}

export function runOp<I extends z.ZodType, O>(ctx: OpContext, op: OpDef<I, O>, input: unknown): OpResult<O> {
  const parsed = op.input.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail("INVALID_INPUT", `${op.name}: ${issue?.message ?? "input tidak valid"}`, issue?.path.map(String));
  }

  let result: OpResult<O> = fail("INVALID_RESULT", `${op.name}: op tidak menghasilkan apa pun`);
  ctx.doc.transact(() => {
    result = op.run(ctx, parsed.data);
  }, ctx.origin);
  return result;
}
