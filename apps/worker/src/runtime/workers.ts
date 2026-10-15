import { QUEUE_POLICIES, type QueueName } from "@platform/shared/contracts";
import type { Logger } from "@platform/shared/node";
import { type Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import type { ProcessableQueue, ProcessorRegistry } from "../processors/types";
import { deadLetterEntry, isFinalFailure } from "./dead-letter";
import { jobRunner } from "./run-job";

// Satu proses mendaftarkan worker BullMQ untuk queue terpilih (ARCHITECTURE §5.4; dipecah via WORKER_QUEUES).

// SIGTERM → tunggu job aktif selesai maksimal sekian, lalu paksa tutup (job aktif kembali ke antrean saat stalled).
export const SHUTDOWN_TIMEOUT_MS = 30_000;

export interface RunningWorkers {
  queues: readonly ProcessableQueue[];
  close: (timeoutMs?: number) => Promise<void>;
}

/** Queue yang dijalankan: `all` = semua yang punya processor; daftar eksplisit tanpa processor = salah konfigurasi. */
export function selectQueues(
  selection: "all" | readonly QueueName[],
  processors: ProcessorRegistry,
): ProcessableQueue[] {
  const registered = Object.keys(processors) as ProcessableQueue[];
  if (selection === "all") return registered;
  const missing = selection.filter((queue) => !(registered as readonly string[]).includes(queue));
  if (missing.length > 0) throw new Error(`WORKER_QUEUES memuat queue tanpa processor: ${missing.join(", ")}`);
  return selection as ProcessableQueue[];
}

export function startWorkers(options: {
  redisUrl: string;
  queues: readonly ProcessableQueue[];
  processors: ProcessorRegistry;
  logger: Logger;
  // Namespace key Redis (sama dengan producer api; test memakai prefix sendiri).
  prefix?: string;
}): RunningWorkers {
  // BullMQ mewajibkan `maxRetriesPerRequest: null` untuk koneksi worker (perintah blocking).
  const connection = new Redis(options.redisUrl, { maxRetriesPerRequest: null });
  let connectionErrorLogged = false;
  connection.on("error", (error) => {
    if (!connectionErrorLogged) options.logger.warn({ err: error }, "redis worker tidak terhubung");
    connectionErrorLogged = true;
  });
  connection.on("ready", () => {
    connectionErrorLogged = false;
  });

  // Producer ke `dead-letter` (diproses instance mana pun yang menjalankan queue itu).
  const deadLetter = new Queue("dead-letter", { connection, prefix: options.prefix ?? "bull" });
  const sendToDeadLetter = async (queue: ProcessableQueue, job: Job, error: Error) => {
    if (queue === "dead-letter") {
      // Tidak ada DLQ untuk DLQ: data tetap ada di set `failed` BullMQ + log.
      options.logger.error({ err: error, jobId: job.id, alert: "dlq" }, "job dead-letter gagal disimpan");
      return;
    }
    const entry = deadLetterEntry(queue, job, error);
    await deadLetter.add(`${queue}:${entry.jobId}`, entry, {
      attempts: QUEUE_POLICIES["dead-letter"].attempts,
      // Idempoten: event `failed` yang sama tidak menggandakan entri. Tanpa ":" (BullMQ menolak id custom ber-":"
      // kecuali tepat 3 segmen).
      jobId: `dlq-${queue}-${entry.jobId}-${entry.attempts}`,
    });
  };

  const startWorker = <Q extends ProcessableQueue>(queue: Q) => {
    const handler = options.processors[queue];
    if (!handler) throw new Error(`processor ${queue} tidak terdaftar`);
    const worker = new Worker(queue, jobRunner(queue, handler, { logger: options.logger }), {
      connection,
      prefix: options.prefix ?? "bull",
      concurrency: QUEUE_POLICIES[queue].concurrency,
    });
    // Tanpa listener, error koneksi worker menjadi unhandled.
    worker.on("error", (error) => options.logger.warn({ err: error, queue }, "worker BullMQ error"));
    worker.on("failed", (job, error) => {
      if (!job || !isFinalFailure(job)) return;
      sendToDeadLetter(queue, job, error).catch((dlqError: unknown) =>
        options.logger.error(
          { err: dlqError, queue, jobId: job.id, alert: "dlq" },
          "gagal mengirim job ke dead-letter",
        ),
      );
    });
    return worker;
  };
  const workers = options.queues.map(startWorker);

  return {
    queues: options.queues,
    close: async (timeoutMs = SHUTDOWN_TIMEOUT_MS) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const forced = new Promise<"forced">((resolve) => {
        timer = setTimeout(() => resolve("forced"), timeoutMs);
      });
      const graceful = Promise.all(workers.map((worker) => worker.close())).then(() => "graceful" as const);
      // `close(true)` BullMQ mengembalikan promise close pertama (tetap menunggu job) → bila batas lewat, berhenti
      // menunggu dan putuskan koneksi; lock job aktif kedaluwarsa → job "stalled" diambil ulang worker lain.
      graceful.catch((error: unknown) => options.logger.warn({ err: error }, "penutupan worker gagal"));
      graceful.finally(() => deadLetter.close()).catch(() => {});
      if ((await Promise.race([graceful, forced])) === "forced") {
        options.logger.warn({ timeoutMs }, "job aktif melewati batas shutdown; worker dihentikan tanpa menunggu");
      }
      clearTimeout(timer);
      connection.disconnect();
    },
  };
}
