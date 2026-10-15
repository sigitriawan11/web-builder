import type { Db } from "@platform/db";
import type { CleanupTask } from "@platform/shared/contracts";
import type { JobContext, JobHandler } from "../types";
import { countCompactionCandidates } from "./cleanup.repository";

// Processor queue `cleanup` (ARCHITECTURE §5.4, §7.4): satu job = satu tugas pemeliharaan terjadwal.
// M1 = kerangka: compaction hanya menghitung kandidat; penghapusan update lama + thinning snapshot `auto` mengikuti
// retensi history paket (spec 08) di M4.

type TaskHandler = (context: JobContext) => Promise<void>;

export function createCleanupProcessor(deps: { db: Db }): JobHandler<"cleanup"> {
  const tasks: Record<CleanupTask, TaskHandler> = {
    "compact-documents": async ({ logger }) => {
      const candidates = await countCompactionCandidates(deps.db);
      logger.info({ task: "compact-documents", ...candidates }, "kandidat compaction (penghapusan menyusul M4)");
    },
  };
  return async (payload, context) => tasks[payload.task](context);
}
