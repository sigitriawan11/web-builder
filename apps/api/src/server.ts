import type { Server } from "node:http";
import { createDb, sql } from "@platform/db";
import { contextLogFields, createLogger, type Logger, type LoggerOptions } from "@platform/shared/node";
import { createApp } from "./app";
import { createAuth } from "./auth/auth";
import { turnstileVerifier } from "./auth/captcha";
import type { ApiEnv } from "./config/env";
import { storageCheck } from "./health/readiness";
import { createRedis, waitForRedis } from "./lib/redis";
import { createQueueProducer } from "./queues/producer";

// Batas tunggu request yang sedang berjalan saat shutdown, sebelum koneksi dipaksa tutup.
export const SHUTDOWN_TIMEOUT_MS = 10_000;
// Lama menunggu Redis saat start sebelum tetap melayani tanpa Redis.
export const REDIS_CONNECT_TIMEOUT_MS = 5_000;

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

export async function startServer(
  env: ApiEnv,
  options: { redisConnectTimeoutMs?: number } = {},
): Promise<RunningServer> {
  const logger = createApiLogger(env);
  const { db, close: closeDb } = createDb({
    connectionString: env.DATABASE_URL,
    maxConnections: env.DATABASE_POOL_MAX,
  });
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
  // Mulai melayani setelah Redis siap, agar readiness & rate limit langsung akurat. Redis mati → tetap start
  // (rate limit memakai limiter cadangan, /health/ready melapor 503).
  await waitForRedis(redis, options.redisConnectTimeoutMs ?? REDIS_CONNECT_TIMEOUT_MS);
  // Producer BullMQ (koneksi Redis sendiri); dipakai service lewat afterCommit (T1.4.8).
  let queueErrorLogged = false;
  const queues = createQueueProducer(env.REDIS_URL, {
    onError: (error) => {
      if (!queueErrorLogged) logger.warn({ err: error }, "koneksi antrean BullMQ bermasalah");
      queueErrorLogged = true;
    },
  });
  const auth = createAuth({
    db,
    redis,
    logger,
    queues,
    config: {
      secret: env.BETTER_AUTH_SECRET,
      publicAuthUrl: env.BETTER_AUTH_URL,
      trustedOrigins: [env.PUBLIC_APP_URL],
      // Lokal memakai http; cookie `Secure` hanya di staging/production.
      secureCookies: env.APP_ENV !== "local",
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {}),
    },
  });
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) logger.info("login Google nonaktif (GOOGLE_CLIENT_* kosong)");
  const app = createApp({
    logger,
    db,
    auth,
    verifyCaptcha: turnstileVerifier(env.CAPTCHA_SECRET, (error) =>
      logger.warn({ err: error }, "verifikasi Turnstile gagal dihubungi"),
    ),
    redis,
    queues,
    internalJwtSecret: env.INTERNAL_JWT_SECRET,
    readinessChecks: {
      db: async () => {
        await db.execute(sql`select 1`);
      },
      redis: async () => {
        await redis.ping();
      },
      storage: storageCheck(env.S3_ENDPOINT),
    },
  });

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
      await queues.close();
      await closeDb();
      redis.disconnect();
      logger.info("api shutdown selesai");
    })();
    return closing;
  };

  return { server, logger, close };
}
