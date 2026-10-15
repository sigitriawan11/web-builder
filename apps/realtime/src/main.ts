import { createDb } from "@platform/db";
import { createLogger } from "@platform/shared/node";
import { Redis } from "ioredis";
import { loadRealtimeEnv } from "./config/env";
import { PersistenceExtension } from "./extensions/persistence";
import { SingleEditorLockExtension } from "./extensions/single-editor-lock";
import { EditorLock } from "./lock/editor-lock";
import { createRealtimeServer } from "./server";

// Entry apps/realtime: env tervalidasi → server Hocuspocus → graceful shutdown pada SIGTERM/SIGINT.
const env = loadRealtimeEnv();
// ARCHITECTURE §5.5: TTL 30 s, diperpanjang heartbeat (10 s) selama pemegang tersambung.
const LOCK_TTL_MS = 30_000;
const logger = createLogger({
  service: "realtime",
  env: env.APP_ENV,
  level: env.LOG_LEVEL,
  pretty: env.APP_ENV === "local",
});
const { db, close: closeDb } = createDb({ connectionString: env.DATABASE_URL, maxConnections: env.DATABASE_POOL_MAX });
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
const server = createRealtimeServer({
  port: env.REALTIME_PORT,
  host: env.REALTIME_HOST,
  tokenSecret: env.REALTIME_TOKEN_SECRET,
  logger,
  lock: new SingleEditorLockExtension({ lock: new EditorLock(redis, LOCK_TTL_MS), db, logger }),
  extensions: [
    new PersistenceExtension({
      db,
      logger,
      flushDebounceMs: env.REALTIME_FLUSH_DEBOUNCE_MS,
      flushMaxWaitMs: env.REALTIME_FLUSH_MAX_MS,
      snapshotEveryUpdates: env.REALTIME_SNAPSHOT_EVERY,
      snapshotIntervalMs: env.REALTIME_SNAPSHOT_INTERVAL_MS,
    }),
  ],
});
await server.listen();
logger.info({ url: server.webSocketURL }, "realtime siap");

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server
      .destroy()
      .then(() => closeDb())
      .then(() => redis.quit())
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error({ err: error }, "shutdown gagal");
        process.exit(1);
      });
  });
}
