import type { Server } from "node:http";
import { createDb } from "@platform/db";
import { contextLogFields, createLogger, type Logger, type LoggerOptions } from "@platform/shared/node";
import { createApp } from "./app";
import type { ApiEnv } from "./config/env";
import { createRedis } from "./lib/redis";

// Batas tunggu request yang sedang berjalan saat shutdown, sebelum koneksi dipaksa tutup.
export const SHUTDOWN_TIMEOUT_MS = 10_000;

export interface RunningServer {
  server: Server;
  logger: Logger;
  close: (reason: string) => Promise<void>;
}

/** Logger api: JSON (pretty di lokal) + konteks request (requestId, user, tenant) di setiap baris. */
export function createApiLogger(
  env: Pick<ApiEnv, "APP_ENV" | "LOG_LEVEL">,
  destination?: LoggerOptions["destination"],
): Logger {
  return createLogger({
    service: "api",
    env: env.APP_ENV,
    level: env.LOG_LEVEL,
    pretty: env.APP_ENV === "local" && !destination,
    mixin: contextLogFields,
    ...(destination ? { destination } : {}),
  });
}

export async function startServer(env: ApiEnv): Promise<RunningServer> {
  const logger = createApiLogger(env);
  const { close: closeDb } = createDb({ connectionString: env.DATABASE_URL, maxConnections: env.DATABASE_POOL_MAX });
  const redis = createRedis(env.REDIS_URL);
  // Tanpa listener, event `error` ioredis (mis. Redis mati) membuat proses crash.
  let redisDownLogged = false;
  redis.on("error", (error) => {
    if (!redisDownLogged) logger.warn({ err: error }, "redis tidak terhubung; rate limit memakai limiter cadangan");
    redisDownLogged = true;
  });
  redis.on("ready", () => {
    redisDownLogged = false;
  });
  const app = createApp({ logger, redis });

  const server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(env.API_PORT, (error?: Error) => (error ? reject(error) : resolve(listening)));
  });
  logger.info({ port: env.API_PORT }, "api listening");

  let closing: Promise<void> | null = null;
  const close = (reason: string) => {
    closing ??= (async () => {
      logger.info({ reason }, "api shutdown dimulai");
      const forced = setTimeout(() => {
        logger.warn("shutdown melewati batas waktu; koneksi dipaksa tutup");
        server.closeAllConnections();
      }, SHUTDOWN_TIMEOUT_MS);
      forced.unref();
      // Berhenti menerima koneksi baru, tunggu request berjalan selesai, tutup koneksi keep-alive yang menganggur.
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeIdleConnections();
      });
      clearTimeout(forced);
      await closeDb();
      redis.disconnect();
      logger.info("api shutdown selesai");
    })();
    return closing;
  };

  return { server, logger, close };
}
