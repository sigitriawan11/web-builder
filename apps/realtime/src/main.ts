import { createDb } from "@platform/db";
import { createLogger } from "@platform/shared/node";
import { loadRealtimeEnv } from "./config/env";
import { PersistenceExtension } from "./extensions/persistence";
import { createRealtimeServer } from "./server";

// Entry apps/realtime: env tervalidasi → server Hocuspocus → graceful shutdown pada SIGTERM/SIGINT.
const env = loadRealtimeEnv();
const logger = createLogger({
  service: "realtime",
  env: env.APP_ENV,
  level: env.LOG_LEVEL,
  pretty: env.APP_ENV === "local",
});
const { db, close: closeDb } = createDb({ connectionString: env.DATABASE_URL, maxConnections: env.DATABASE_POOL_MAX });
const server = createRealtimeServer({
  port: env.REALTIME_PORT,
  host: env.REALTIME_HOST,
  tokenSecret: env.REALTIME_TOKEN_SECRET,
  logger,
  extensions: [new PersistenceExtension({ db, logger })],
});
await server.listen();
logger.info({ url: server.webSocketURL }, "realtime siap");

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server
      .destroy()
      .then(() => closeDb())
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error({ err: error }, "shutdown gagal");
        process.exit(1);
      });
  });
}
