import { loadApiEnv } from "./config/env";
import { startServer } from "./server";

// Entry apps/api: env tervalidasi → server → graceful shutdown pada SIGTERM/SIGINT (ARCHITECTURE §5.3).
const env = loadApiEnv();
const running = await startServer(env);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    running
      .close(signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        running.logger.error({ err: error }, "shutdown gagal");
        process.exit(1);
      });
  });
}
