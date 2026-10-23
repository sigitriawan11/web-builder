import { z } from "zod";

// AI-051/AI-122: kontrak run AI (buat + apply/discard). Event stream = SSE (bukan JSON), tak di sini.

export const AiRunKindSchema = z.enum(["admin", "inline", "chat"]);

export const CreateAiRunBodySchema = z.object({
  kind: AiRunKindSchema.default("admin"),
  prompt: z.string().min(1).max(10_000),
  conversationId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
});
export type CreateAiRunBody = z.infer<typeof CreateAiRunBodySchema>;

export const CreateAiRunResponseSchema = z.object({ runId: z.string().uuid() });
export type CreateAiRunResponse = z.infer<typeof CreateAiRunResponseSchema>;

export const AiRunDecisionResponseSchema = z.object({
  draftStatus: z.enum(["pending", "applied", "discarded", "partially_applied"]),
});
export type AiRunDecisionResponse = z.infer<typeof AiRunDecisionResponseSchema>;
