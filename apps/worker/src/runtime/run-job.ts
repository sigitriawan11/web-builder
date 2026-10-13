import { parseJobPayload, QUEUE_POLICIES } from "@platform/shared/contracts";
import { type Logger, runWithContext } from "@platform/shared/node";
import { type Job, UnrecoverableError } from "bullmq";
import type { JobHandler, ProcessableQueue } from "../processors/types";

// Pembungkus setiap job: validasi payload (kontrak rusak = tidak di-retry), konteks log (requestId asal + jobId),
// batas waktu per queue, dan log hasil. BullMQ tidak punya timeout job bawaan → Promise.race + AbortSignal.

export function jobRunner<Q extends ProcessableQueue>(
  queue: Q,
  handler: JobHandler<Q>,
  deps: { logger: Logger; timeoutMs?: number },
): (job: Job) => Promise<void> {
  const timeoutMs = deps.timeoutMs ?? QUEUE_POLICIES[queue].timeoutMs;
  return async (job) => {
    const jobId = job.id ?? "unknown";
    let payload: ReturnType<typeof parseJobPayload<Q>>;
    try {
      payload = parseJobPayload(queue, job.data);
    } catch (error) {
      deps.logger.error({ err: error, queue, jobId }, "payload job tidak sesuai kontrak; tidak di-retry");
      throw new UnrecoverableError(`payload ${queue} tidak sesuai kontrak`);
    }

    await runWithContext({ requestId: payload.requestId, jobId }, async () => {
      const attempt = job.attemptsMade + 1;
      const logger = deps.logger.child({ queue, attempt });
      const controller = new AbortController();
      const started = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`job ${queue} melewati batas ${timeoutMs} ms`));
        }, timeoutMs);
      });
      try {
        await Promise.race([handler(payload, { jobId, attempt, signal: controller.signal, logger }), timeout]);
        logger.info({ durationMs: Date.now() - started }, "job selesai");
      } catch (error) {
        logger.warn({ err: error, durationMs: Date.now() - started }, "job gagal");
        throw error;
      } finally {
        clearTimeout(timer);
      }
    });
  };
}
