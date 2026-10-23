import { type Db, eq, schema } from "@platform/db";
import type { AgentRunResult } from "./agent-runner";

// AI-107/AI-160: setelah run, akumulasi token → kolom agregat `ai_runs`; tiap tool call → `ai_tool_calls` (audit).
// Σ usage panggilan model = kolom agregat ai_runs (diuji). `budget_exhausted` dicatat completed (hasil parsial).

export async function persistRun(
  db: Db,
  runId: string,
  result: AgentRunResult,
  extra: {
    draftStatus?: (typeof schema.aiDraftStatusEnum.enumValues)[number];
    touchedNodeIds?: string[];
    modelId?: string;
  } = {},
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.aiRuns)
      .set({
        status: "completed",
        iterations: result.iterations,
        toolCalls: result.toolCalls,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheWriteTokens: result.usage.cacheWriteTokens,
        finishedAt: new Date(),
        ...(extra.draftStatus ? { draftStatus: extra.draftStatus } : {}),
        ...(extra.touchedNodeIds ? { touchedNodeIds: extra.touchedNodeIds } : {}),
        ...(extra.modelId ? { modelId: extra.modelId } : {}),
      })
      .where(eq(schema.aiRuns.id, runId));

    if (result.toolCallRecords.length > 0) {
      await tx.insert(schema.aiToolCalls).values(
        result.toolCallRecords.map((entry) => ({
          runId,
          seq: entry.seq,
          tool: entry.tool,
          status: entry.status === "ok" ? ("ok" as const) : ("error" as const),
          ...(entry.errorCode ? { errorCode: entry.errorCode } : {}),
        })),
      );
    }
  });
}
