import { loadWorkerEnv } from "./config/env";
import { startWorkerProcess } from "./worker-process";

// Entry apps/worker: env tervalidasi → worker + health server → graceful shutdown pada SIGTERM/SIGINT.
const env = loadWorkerEnv();
const running = await startWorkerProcess(env);

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
