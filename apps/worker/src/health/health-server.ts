import type { Server } from "node:http";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { QUEUE_NAMES } from "@platform/shared/contracts";
import { Queue } from "bullmq";
import express, { type Express } from "express";
import type { Redis } from "ioredis";

// Server health worker (ARCHITECTURE §5.4, §13, port 4200): liveness, readiness (Redis), dan Bull Board di lokal
// untuk melihat/mengulang job. Bull Board TIDAK dipasang di staging/production (tanpa auth, bisa menghapus job).

export const BULL_BOARD_PATH = "/queues";
const READY_TIMEOUT_MS = 2_000;

export function createHealthApp(deps: { redis: Redis; bullBoard?: { redis: Redis; prefix?: string } }): {
  app: Express;
  close: () => Promise<void>;
} {
  const app = express();
  app.disable("x-powered-by");
  app.get("/health/live", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/health/ready", async (_req, res) => {
    const ok = await Promise.race([
      deps.redis.ping().then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), READY_TIMEOUT_MS).unref()),
    ]);
    res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not_ready", checks: { redis: ok ? "ok" : "fail" } });
  });

  const boardQueues: Queue[] = [];
  if (deps.bullBoard) {
    const { redis, prefix } = deps.bullBoard;
    // Semua queue ditampilkan (juga yang diproses instance worker lain).
    for (const name of QUEUE_NAMES) boardQueues.push(new Queue(name, { connection: redis, prefix: prefix ?? "bull" }));
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(BULL_BOARD_PATH);
    createBullBoard({ queues: boardQueues.map((queue) => new BullMQAdapter(queue)), serverAdapter });
    app.use(BULL_BOARD_PATH, serverAdapter.getRouter());
  }

  return {
    app,
    close: async () => {
      await Promise.all(boardQueues.map((queue) => queue.close()));
    },
  };
}

export function listen(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, (error?: Error) => (error ? reject(error) : resolve(server)));
  });
}
