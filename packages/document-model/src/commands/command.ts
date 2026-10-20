import type * as Y from "yjs";
import type { z } from "zod";
import type { IdPrefix } from "../ids";
import type { ComponentDefinition } from "../schema";
import type { Issue, IssueDetails, IssueMessage } from "../validate/issues";
import { applyDraftUpdate, draftUpdate, forkDocument } from "../yjs/draft";
import type { TxOrigin } from "../yjs/origin";
import { checkAffectedNodes, normalizeAffectedStyles } from "./post-check";
import { isEffectivelyLocked, nodesMap } from "./y-access";

// DM-073: semua mutasi dokumen lewat command — editor, AI tools, template, migrasi, seed memakai jalur yang sama.

export interface CommandContext {
  doc: Y.Doc;
  // Origin transaksi (DM-060); UndoManager hanya melacak origin milik sesi lokal.
  origin: TxOrigin;
  idGen?: (prefix: IdPrefix) => string;
  // Waktu ISO (metadata createdAt dsb.); bisa disuntik agar deterministik di test.
  now?: () => string;
  // DM-075: lewati penjagaan node terkunci (UI mengirim ini saat user mengonfirmasi mengubah node locked).
  force?: boolean;
  // M3: registry definisi component (library/lokal) — dibutuhkan command yang me-resolve instance (detach,
  // updateInstanceVersion). Disuntik editor/worker; command pure yang tak butuh registry mengabaikannya.
  getComponent?: (componentId: string, version: number) => ComponentDefinition | undefined;
  // Schema validasi node untuk pasca-cek command (default: schema node situs). Dokumen ComponentDefinition menyuntik
  // `ComponentNodeSchema` — root ber-`parentId: null` sah di sana, ditolak schema situs.
  nodeSchema?: z.ZodTypeAny;
}

// DM-075: command yang boleh menyentuh node terkunci tanpa `force` (lock/visibility & operasi page).
const LOCK_EXEMPT_COMMANDS = new Set([
  "setLocked",
  "setVisible",
  "createPage",
  "updatePage",
  "reorderPages",
  "deletePage",
]);

/** ID node yang menjadi TARGET command dari input (`id` tunggal atau `ids` array). */
function targetNodeIds(input: unknown): string[] {
  if (typeof input !== "object" || input === null) return [];
  const record = input as Record<string, unknown>;
  const ids: string[] = [];
  if (typeof record.id === "string") ids.push(record.id);
  if (Array.isArray(record.ids)) for (const id of record.ids) if (typeof id === "string") ids.push(id);
  return ids;
}

export type CommandErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "INVALID_TARGET"
  | "CYCLE"
  | "INVALID_RESULT"
  // DM-076: batas teknis dokumen; `details.limit` = nama batas (bukan batas paket `PLAN_LIMIT_REACHED`).
  | "LIMIT_EXCEEDED"
  // Pasca-cek menemukan node rusak setelah command → bug di command (kontrak periksa-dulu dilanggar).
  | "INVARIANT_VIOLATION"
  // DM-075: node (atau ancestor) terkunci; UI bisa mengirim `force` untuk tetap mengubah.
  | "LOCKED";

/** Error command: kode stabil + pesan dwibahasa (dipakai editor & dikembalikan ke model AI). */
export interface CommandError {
  code: CommandErrorCode;
  message: IssueMessage;
  path?: (string | number)[];
  details?: IssueDetails;
}

export type CommandFailure = { ok: false; error: CommandError };
export type CommandResult<T> = { ok: true; value: T; affected: string[]; warnings?: Issue[] } | CommandFailure;

// Kontrak `run`: periksa semua syarat SEBELUM menulis apa pun. Yjs tidak punya rollback, jadi command yang gagal
// tidak boleh meninggalkan perubahan parsial. Batch atomik lewat `runCommands` (fork).
export interface CommandDef<I extends z.ZodType, O> {
  name: string;
  description: IssueMessage;
  // Tersedia sebagai tool AI (M6); input Zod sekaligus menjadi JSON Schema tool.
  aiExposed: boolean;
  input: I;
  run(ctx: CommandContext, input: z.infer<I>): CommandResult<O>;
}

// Identitas saja; ada supaya tipe `input` di `run` diturunkan dari schema Zod-nya.
export function defineCommand<I extends z.ZodType, O>(def: CommandDef<I, O>): CommandDef<I, O> {
  return def;
}

export function fail(
  code: CommandErrorCode,
  message: IssueMessage,
  path?: (string | number)[],
  details?: IssueDetails,
): CommandFailure {
  return { ok: false, error: { code, message, ...(path ? { path } : {}), ...(details ? { details } : {}) } };
}

function invalidInput(name: string, error: z.ZodError): CommandFailure {
  const issue = error.issues[0];
  const detail = issue?.message ?? "input tidak valid";
  return fail(
    "INVALID_INPUT",
    { id: `${name}: ${detail}`, en: `${name}: invalid input (${detail})` },
    issue?.path.filter((key): key is string | number => typeof key !== "symbol"),
  );
}

/**
 * Jalankan satu command (DM-073): validasi input → `transact(run, origin)` → normalisasi override style node
 * terdampak (DM-036) → pasca-cek ringan pada node terdampak. Satu command = satu transaksi = satu langkah undo.
 */
export function runCommand<I extends z.ZodType, O>(
  ctx: CommandContext,
  def: CommandDef<I, O>,
  input: unknown,
): CommandResult<O> {
  const parsed = def.input.safeParse(input);
  if (!parsed.success) return invalidInput(def.name, parsed.error);

  // DM-075: tolak mengubah node terkunci (kecuali `force` atau command yang dikecualikan).
  if (!ctx.force && !LOCK_EXEMPT_COMMANDS.has(def.name)) {
    const nodes = nodesMap(ctx.doc);
    const locked = targetNodeIds(parsed.data).find((id) => isEffectivelyLocked(nodes, id));
    if (locked) {
      return fail("LOCKED", { id: `Node "${locked}" terkunci`, en: `Node "${locked}" is locked` }, ["id"], {
        nodeId: locked,
      });
    }
  }

  // Ditetapkan di dalam transact; nilai awal hanya bila `run` tidak pernah terpanggil.
  let result = fail("INVALID_RESULT", {
    id: `${def.name}: command tidak menghasilkan apa pun`,
    en: `${def.name}: command produced no result`,
  }) as CommandResult<O>;
  ctx.doc.transact(() => {
    const outcome = def.run(ctx, parsed.data);
    if (outcome.ok) normalizeAffectedStyles(ctx.doc, outcome.affected);
    result = outcome;
  }, ctx.origin);

  if (!result.ok) return result;
  const issues = checkAffectedNodes(ctx.doc, result.affected, ctx.nodeSchema);
  if (issues.length > 0) {
    const [first] = issues;
    return fail(
      "INVARIANT_VIOLATION",
      {
        id: `${def.name} menghasilkan dokumen tidak valid: ${first?.message.id}`,
        en: `${def.name} produced an invalid document: ${first?.message.en}`,
      },
      first?.path,
      { command: def.name, issues: issues.length },
    );
  }
  return result;
}

export type CommandStep = { [K in string]: { def: CommandDef<z.ZodType, unknown>; input: unknown } }[string];

/** Helper bertipe untuk menyusun langkah batch. */
export function step<I extends z.ZodType, O>(def: CommandDef<I, O>, input: z.input<I>): CommandStep {
  return { def: def as unknown as CommandDef<z.ZodType, unknown>, input };
}

/**
 * Batch atomik (DM-073): semua langkah dijalankan di fork dokumen; bila SATU gagal, dokumen asli tidak berubah sama
 * sekali. Bila semua berhasil, perubahan diterapkan sebagai satu transaksi `ctx.origin` (satu langkah undo).
 * Langkah berikutnya melihat hasil langkah sebelumnya (mis. ID node yang baru dibuat).
 */
export function runCommands(
  ctx: CommandContext,
  steps: readonly CommandStep[] | ((results: unknown[]) => CommandStep | null),
): CommandResult<unknown[]> {
  const fork = forkDocument(ctx.doc);
  const forkCtx: CommandContext = { ...ctx, doc: fork.draft };
  const values: unknown[] = [];
  const affected = new Set<string>();
  const warnings: Issue[] = [];
  const next = typeof steps === "function" ? steps : (results: unknown[]) => steps[results.length] ?? null;

  try {
    for (let current = next(values); current; current = next(values)) {
      const result = runCommand(forkCtx, current.def, current.input);
      if (!result.ok) {
        return fail(result.error.code, result.error.message, result.error.path, {
          ...result.error.details,
          step: values.length,
          command: current.def.name,
        });
      }
      values.push(result.value);
      for (const id of result.affected) affected.add(id);
      if (result.warnings) warnings.push(...result.warnings);
    }
    applyDraftUpdate(ctx.doc, draftUpdate(fork), ctx.origin);
    return { ok: true, value: values, affected: [...affected], ...(warnings.length > 0 ? { warnings } : {}) };
  } finally {
    fork.draft.destroy();
  }
}
