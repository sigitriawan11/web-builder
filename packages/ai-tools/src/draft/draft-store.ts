import {
  aiOrigin,
  applyDraft,
  type CommandContext,
  type CommandDef,
  type CommandResult,
  type DocumentFork,
  draftUpdate,
  forkDocument,
  runCommand,
} from "@platform/document-model";
import type * as Y from "yjs";
import type { z } from "zod";

// AI-120/121/122/126/061 / ARCHITECTURE §10.4: draft store per run. Worker fork Y.Doc dokumen (fork), semua mutasi tool
// berjalan di draft dengan origin `ai:<runId>`. "Terapkan" = encode update draft (sejak base) → applyDraft ke dokumen
// utama dalam satu transaksi → SATU langkah undo. "Discard" = buang draft. `touched` = node yang disentuh (ai_runs).
//
// Satu-satunya file ai-tools yang boleh `import * as Y` (AI-061); tools/** memakai command API, bukan Y langsung.

export class DraftSession {
  readonly draft: Y.Doc;
  readonly base: Uint8Array;
  readonly runId: string;
  private readonly touched = new Set<string>();
  private readonly extraCtx: Partial<CommandContext>;

  constructor(main: Y.Doc, runId: string, extraCtx: Partial<CommandContext> = {}) {
    const fork: DocumentFork = forkDocument(main);
    this.draft = fork.draft;
    this.base = fork.base;
    this.runId = runId;
    this.extraCtx = extraCtx;
  }

  /** CommandContext draft dengan origin `ai:<runId>` (+ injeksi registry/nodeSchema bila disediakan). */
  commandContext(): CommandContext {
    return { doc: this.draft, origin: aiOrigin(this.runId), ...this.extraCtx };
  }

  /** Jalankan satu command di draft (satu Y.transact). Node `affected` dicatat ke `touched` (AI-120). */
  run<I extends z.ZodType, O>(def: CommandDef<I, O>, input: unknown): CommandResult<O> {
    const result = runCommand(this.commandContext(), def, input);
    if (result.ok) for (const id of result.affected) this.touched.add(id);
    return result;
  }

  /** Update biner draft sejak fork — disimpan tiap iterasi (ai-drafts/{siteId}/{runId}) & dipakai apply. */
  update(): Uint8Array {
    return draftUpdate({ draft: this.draft, base: this.base });
  }

  touchedNodeIds(): string[] {
    return [...this.touched];
  }

  /** Terapkan draft ke dokumen utama sebagai SATU langkah undo (AI-122; undoManager.stopCapturing di applyDraft). */
  apply(main: Y.Doc, undoManager?: Pick<Y.UndoManager, "stopCapturing" | "addTrackedOrigin">): void {
    applyDraft(main, this.update(), this.runId, undoManager);
  }

  /** Buang draft (run di-discard / editor tertutup lalu run kedaluwarsa). */
  discard(): void {
    this.draft.destroy();
  }
}
