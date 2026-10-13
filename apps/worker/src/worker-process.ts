import type { Server } from "node:http";
import { contextLogFields, createLogger, type Logger, type LoggerOptions } from "@platform/shared/node";
import { Redis } from "ioredis";
import type { WorkerEnv } from "./config/env";
import { createHealthApp, listen } from "./health/health-server";
import { createProcessors } from "./processors";
import type { ProcessorRegistry } from "./processors/types";
import { selectQueues, startWorkers } from "./runtime/workers";

// Proses worker (ARCHITECTURE §5.4): env → worker BullMQ per queue → health server. `close()` = graceful shutdown.

export interface RunningWorkerProcess {
  server: Server;
  logger: Logger;
  queues: readonly string[];
  close: (reason: string) => Promise<void>;
}

export function createWorkerLogger(
  env: Pick<WorkerEnv, "APP_ENV" | "LOG_LEVEL">,
  destination?: LoggerOptions["destination"],
): Logger {
  return createLogger({
    service: "worker",
    env: env.APP_ENV,
    level: env.LOG_LEVEL,
    pretty: env.APP_ENV === "local" && !destination,
    mixin: contextLogFields,
    ...(destination ? { destination } : {}),
  });
}

export async function startWorkerProcess(
  env: WorkerEnv,
  options: { logger?: Logger; processors?: ProcessorRegistry; prefix?: string; shutdownTimeoutMs?: number } = {},
): Promise<RunningWorkerProcess> {
  const logger = options.logger ?? createWorkerLogger(env);
  const processors = options.processors ?? createProcessors();
  const queues = selectQueues(env.WORKER_QUEUES, processors);
  if (queues.length === 0) logger.warn("belum ada processor terdaftar; worker hanya melayani health");

  const workers = startWorkers({
    redisUrl: env.REDIS_URL,
    queues,
    processors,
    logger,
    ...(options.prefix ? { prefix: options.prefix } : {}),
  });
  // Koneksi terpisah untuk readiness & Bull Board: perintah gagal cepat saat Redis mati (tidak menumpuk).
  const redis = new Redis(env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
  redis.on("error", () => {
    // Dicatat oleh koneksi worker; readiness melapor 503.
  });
  const health = createHealthApp({
    redis,
    ...(env.APP_ENV === "local" ? { bullBoard: { redis, ...(options.prefix ? { prefix: options.prefix } : {}) } } : {}),
  });
  const server = await listen(health.app, env.WORKER_HEALTH_PORT);
  logger.info({ port: env.WORKER_HEALTH_PORT, queues }, "worker berjalan");

  let closing: Promise<void> | null = null;
  const close = (reason: string) => {
    closing ??= (async () => {
      logger.info({ reason }, "worker shutdown dimulai");
      await workers.close(options.shutdownTimeoutMs);
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      await health.close();
      redis.disconnect();
      logger.info("worker shutdown selesai");
    })();
    return closing;
  };

  return { server, logger, queues, close };
}
