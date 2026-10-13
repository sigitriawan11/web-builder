import type { JOB_PAYLOADS, JobPayload } from "@platform/shared/contracts";
import type { Logger } from "@platform/shared/node";

// Kontrak processor: menerima payload yang SUDAH tervalidasi kontrak job (jobs.ts) dan konteks eksekusi.

export type ProcessableQueue = keyof typeof JOB_PAYLOADS;

export interface JobContext {
  jobId: string;
  // Percobaan ke-n (mulai 1).
  attempt: number;
  // Dibatalkan saat job melewati `timeoutMs` queue; handler yang berjalan lama wajib menghormatinya.
  signal: AbortSignal;
  logger: Logger;
}

export type JobHandler<Q extends ProcessableQueue> = (payload: JobPayload<Q>, context: JobContext) => Promise<void>;

export type ProcessorRegistry = { [Q in ProcessableQueue]?: JobHandler<Q> };
