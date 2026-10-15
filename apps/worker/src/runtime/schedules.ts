import { type CleanupTask, QUEUE_POLICIES } from "@platform/shared/contracts";
import type { Queue } from "bullmq";

// Job berulang (ARCHITECTURE §5.4 "scheduler (repeatable)"): didaftarkan worker yang menjalankan queue `cleanup`.
// `upsertJobScheduler` idempoten per id → aman dijalankan setiap instance/boot (tidak menggandakan jadwal).

export const SCHEDULE_TIMEZONE = "Asia/Jakarta";

export interface CleanupSchedule {
  task: CleanupTask;
  // Pola cron (zona SCHEDULE_TIMEZONE).
  pattern: string;
}

export const cleanupSchedulerId = (task: CleanupTask) => `cleanup-${task}`;

export async function registerCleanupSchedules(queue: Queue, schedules: readonly CleanupSchedule[]): Promise<void> {
  for (const schedule of schedules) {
    await queue.upsertJobScheduler(
      cleanupSchedulerId(schedule.task),
      { pattern: schedule.pattern, tz: SCHEDULE_TIMEZONE },
      {
        name: schedule.task,
        // Job terjadwal tidak punya request asal; requestId menandai sumbernya untuk log.
        data: { requestId: `scheduler:${schedule.task}`, task: schedule.task },
        opts: { attempts: QUEUE_POLICIES.cleanup.attempts },
      },
    );
  }
}
