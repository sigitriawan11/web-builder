import type { Db } from "@platform/db";
import type { JobHandler } from "../types";
import { insertDeadLetterJob } from "./dead-letter.repository";

// Processor queue `dead-letter` (ARCHITECTURE §5.4): simpan job gagal final ke `dead_letter_jobs` lalu alert.
// Alert = log level error ber-`alert: "dlq"` (aturan alert "DLQ bertambah", §13); Sentry menyusul (T1.16.3).

export function createDeadLetterProcessor(deps: { db: Db }): JobHandler<"dead-letter"> {
  return async (payload, { logger }) => {
    const id = await insertDeadLetterJob(deps.db, payload);
    logger.error(
      {
        alert: "dlq",
        deadLetterId: id,
        sourceQueue: payload.sourceQueue,
        sourceJobId: payload.jobId,
        attempts: payload.attempts,
        error: payload.error.message,
      },
      "job gagal final masuk dead-letter",
    );
  };
}
