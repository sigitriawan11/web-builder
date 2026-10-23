import { z } from "zod";

// AI-051: buat run + stream SSE. M3 = mode admin (produksi library). `kind` dibatasi yang relevan M3.
export const createRunRequest = {
  body: z.object({
    kind: z.enum(["admin", "inline", "chat"]).default("admin"),
    prompt: z.string().min(1).max(10_000),
    conversationId: z.uuid().optional(),
    siteId: z.uuid().optional(),
  }),
};

export const runEventsRequest = {
  params: z.object({ runId: z.uuid() }),
  query: z.object({ lastEventId: z.string().max(64).optional(), close: z.coerce.boolean().optional() }),
};

// AI-122: terapkan/buang draft hasil run. M3 admin: catat keputusan (`draft_status`). Apply draft ke dokumen = worker.
export const runDecisionRequest = {
  params: z.object({ runId: z.uuid() }),
};
