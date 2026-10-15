import type { Server } from "node:http";
import { createDb } from "@platform/db";
import { contextLogFields, createLogger, type Logger, type LoggerOptions } from "@platform/shared/node";
import { Redis } from "ioredis";
import type { WorkerEnv } from "./config/env";
import { createEmailProvider } from "./email/provider";
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

interface WorkerResources {
  processors: ProcessorRegistry;
  emailProvider: ReturnType<typeof createEmailProvider>;
  closeDb: () => Promise<void>;
}

/** Dependensi nyata processor (DB, provider email); test boleh menyuntik `processors` sendiri. */
function createResources(env: WorkerEnv): WorkerResources {
  const { db, close: closeDb } = createDb({
    connectionString: env.DATABASE_URL,
    maxConnections: env.DATABASE_POOL_MAX,
  });
  const emailProvider = createEmailProvider(
    env.EMAIL_PROVIDER === "smtp"
      ? { provider: "smtp", smtpUrl: env.SMTP_URL ?? "" }
      : { provider: "resend", apiKey: env.RESEND_API_KEY ?? "" },
  );
  const processors = createProcessors({
    db,
    email: {
      db,
      provider: emailProvider,
      from: env.EMAIL_FROM,
      appUrl: env.PUBLIC_APP_URL.replace(/\/$/, ""),
      ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
    },
  });
  return { processors, emailProvider, closeDb };
}

export async function startWorkerProcess(
  env: WorkerEnv,
  options: { logger?: Logger; processors?: ProcessorRegistry; prefix?: string; shutdownTimeoutMs?: number } = {},
): Promise<RunningWorkerProcess> {
  const logger = options.logger ?? createWorkerLogger(env);
  const resources = options.processors ? undefined : createResources(env);
  const processors = options.processors ?? (resources as WorkerResources).processors;
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
      resources?.emailProvider.close?.();
      await resources?.closeDb();
      logger.info("worker shutdown selesai");
    })();
    return closing;
  };

  return { server, logger, queues, close };
}
