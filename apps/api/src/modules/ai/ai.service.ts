import type { Db } from "@platform/db";
import { AppError } from "@platform/shared";
import type { Logger } from "@platform/shared/node";
import type { z } from "zod";
import * as repo from "./ai.repository";
import type { createRunRequest } from "./ai.schema";

// AI-051: buat run (ai_runs) + (M6) enqueue worker. M3 = fondasi admin: run tercatat; eksekusi AgentRunner worker =
// follow-up (processor BullMQ `ai-runs`). Event di-stream lewat SSE (`ai.sse.ts`).

export interface AiActor {
  userId: string;
}

type CreateRunInput = z.infer<typeof createRunRequest.body>;

export function createAiService(deps: { db: Db; logger: Logger }) {
  const { db } = deps;
  return {
    /** Buat run AI (status queued). Mengembalikan runId untuk dibuka via SSE. */
    async createRun(actor: AiActor, input: CreateRunInput): Promise<{ runId: string }> {
      const runId = await repo.insertRun(db, {
        kind: input.kind,
        status: "queued",
        userId: actor.userId,
        ...(input.conversationId ? { conversationId: input.conversationId } : {}),
        ...(input.siteId ? { siteId: input.siteId } : {}),
      });
      return { runId };
    },

    /** Run by id (untuk otorisasi SSE + status). 404 bila tak ada. */
    async getRun(runId: string): Promise<repo.AiRunRow> {
      const run = await repo.findRun(db, runId);
      if (!run) throw new AppError("NOT_FOUND");
      return run;
    },

    /**
     * AI-122: terapkan/buang draft run. M3 admin: catat `draft_status` (apply draft Yjs ke dokumen utama = worker,
     * follow-up). Publish event agar klien SSE lain tahu keputusan.
     */
    async decide(runId: string, decision: "applied" | "discarded"): Promise<{ draftStatus: string }> {
      const run = await repo.findRun(db, runId);
      if (!run) throw new AppError("NOT_FOUND");
      await repo.updateRun(db, runId, { draftStatus: decision });
      return { draftStatus: decision };
    },
  };
}

export type AiService = ReturnType<typeof createAiService>;
