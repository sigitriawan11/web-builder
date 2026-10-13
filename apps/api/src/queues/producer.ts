import { type JOB_PAYLOADS, type JobPayload, parseJobPayload } from "@platform/shared/contracts";
import { type JobsOptions, Queue } from "bullmq";
import { Redis } from "ioredis";

// Producer job BullMQ (ARCHITECTURE §5.4): payload divalidasi skema kontrak sebelum masuk antrean, retensi sesuai
// konvensi. Dipanggil lewat `afterCommit` (with-transaction.ts) agar worker tidak membaca data yang belum commit.

export type ProducibleQueue = keyof typeof JOB_PAYLOADS;

// BullMQ menunggu koneksi siap tanpa batas (mengabaikan enableOfflineQueue) → saat Redis mati, enqueue tanpa batas
// waktu akan menggantung request. Lewat batas ini enqueue gagal (dicatat); job yang akhirnya masuk terlambat aman
// karena job dirancang idempoten (mis. per deploymentId).
export const ENQUEUE_TIMEOUT_MS = 3_000;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 7 * 86_400 },
};

export interface QueueProducer {
  enqueue<Q extends ProducibleQueue>(queue: Q, payload: JobPayload<Q>, options?: JobsOptions): Promise<string>;
  close(): Promise<void>;
}

/**
 * Satu koneksi Redis khusus BullMQ untuk semua antrean. `enableOfflineQueue: false`: enqueue langsung gagal saat
 * Redis mati (tidak menggantung request); `prefix` memisahkan namespace (mis. per test).
 */
export function createQueueProducer(
  redisUrl: string,
  options: { prefix?: string; timeoutMs?: number; onError?: (error: unknown) => void } = {},
): QueueProducer {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
  connection.on("error", () => {
    // Dicatat oleh pemanggil enqueue (error dilempar per perintah); tanpa listener ioredis membuat proses crash.
  });
  const queues = new Map<ProducibleQueue, Queue>();
  const queueFor = (name: ProducibleQueue) => {
    let queue = queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection, prefix: options.prefix ?? "bull", defaultJobOptions: DEFAULT_JOB_OPTIONS });
      // Tanpa listener, BullMQ menulis setiap kegagalan koneksi ke console.
      queue.on("error", (error) => options.onError?.(error));
      queues.set(name, queue);
    }
    return queue;
  };
  return {
    async enqueue(queue, payload, jobOptions) {
      const data = parseJobPayload(queue, payload);
      const timeoutMs = options.timeoutMs ?? ENQUEUE_TIMEOUT_MS;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`enqueue ${queue} melewati ${timeoutMs} ms (Redis tidak terjangkau?)`)),
          timeoutMs,
        );
      });
      try {
        const job = await Promise.race([queueFor(queue).add(queue, data, jobOptions), timeout]);
        return job.id ?? "";
      } finally {
        clearTimeout(timer);
      }
    },
    async close() {
      await Promise.all([...queues.values()].map((queue) => queue.close()));
      connection.disconnect();
    },
  };
}
