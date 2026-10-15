import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "../columns";
import { users } from "./identity";

// Dead-letter job (ARCHITECTURE §5.4, keputusan owner T1.13.3): job yang gagal final di queue mana pun disimpan di
// sini oleh processor `dead-letter` — tahan lama (Redis bukan database), terlihat di admin, bisa di-retry
// (spec 06 COM-054). Level platform (bukan data tenant). Payload sudah disensor (URL bertoken → "[redacted]").

export const deadLetterStatusEnum = pgEnum("dead_letter_status", ["open", "retried", "discarded"]);

export const deadLetterJobs = pgTable(
  "dead_letter_jobs",
  {
    id: id(),
    queue: text().notNull(),
    jobId: text().notNull(),
    jobName: text().notNull(),
    payload: jsonb().$type<unknown>(),
    // { message, stack? } — pesan error terakhir.
    error: jsonb().$type<{ message: string; stack?: string | undefined }>().notNull(),
    attempts: integer().notNull(),
    requestId: text(),
    status: deadLetterStatusEnum().notNull().default("open"),
    failedAt: timestamp({ withTimezone: true }).notNull(),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("dead_letter_jobs_status_failed_at_idx").on(table.status, table.failedAt.desc()),
    index("dead_letter_jobs_queue_job_id_idx").on(table.queue, table.jobId),
  ],
);
