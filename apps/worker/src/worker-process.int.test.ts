import { createServer } from "node:net";
import { uuidv7 } from "@platform/shared";
import { Queue, QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadWorkerEnv } from "./config/env";
import type { ProcessorRegistry } from "./processors/types";
import { createWorkerLogger, type RunningWorkerProcess, startWorkerProcess } from "./worker-process";

// T1.13.1: worker + health server dengan Redis asli; prefix key unik per test agar tidak bentrok dengan dev.
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const logger = createWorkerLogger({ APP_ENV: "local", LOG_LEVEL: "fatal" }, { write: () => {} });
const ids = () => ({ requestId: `req-${uuidv7()}`, documentId: uuidv7(), snapshotId: uuidv7() });

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("port"))));
    });
  });
}

let connection: Redis;
let running: RunningWorkerProcess | undefined;
const queues: Queue[] = [];
beforeAll(() => {
  connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
});
afterEach(async () => {
  await running?.close("test");
  running = undefined;
  await Promise.all(queues.splice(0).map((queue) => queue.obliterate({ force: true }).then(() => queue.close())));
});
afterAll(() => connection.disconnect());

async function start(processors: ProcessorRegistry, extra: Record<string, string> = {}, shutdownTimeoutMs?: number) {
  const prefix = `test-worker-${uuidv7()}`;
  const env = loadWorkerEnv({
    APP_ENV: "local",
    REDIS_URL: redisUrl,
    WORKER_HEALTH_PORT: String(await freePort()),
    DATABASE_URL: "postgres://unused@localhost:5432/unused",
    SMTP_URL: "smtp://localhost:1025",
    EMAIL_FROM: "Platform <no-reply@platformmu.com>",
    PUBLIC_APP_URL: "http://app.localhost:3000",
    // S3 wajib di schema env worker (processor image-processing); tak dipakai test ini.
    S3_ENDPOINT: "http://localhost:9000",
    S3_ACCESS_KEY_ID: "minioadmin",
    S3_SECRET_ACCESS_KEY: "minioadmin",
    ...extra,
  });
  running = await startWorkerProcess(env, {
    logger,
    processors,
    prefix,
    ...(shutdownTimeoutMs ? { shutdownTimeoutMs } : {}),
  });
  const queue = new Queue("thumbnails", { connection, prefix });
  queues.push(queue);
  const events = new QueueEvents("thumbnails", { connection: connection.duplicate(), prefix });
  await events.waitUntilReady();
  return { running, queue, events };
}

describe("proses worker (ARCHITECTURE §5.4)", () => {
  it("job diproses processor queue-nya dengan payload tervalidasi", async () => {
    const received: unknown[] = [];
    const { queue, events } = await start({
      thumbnails: async (payload) => {
        received.push(payload);
      },
    });
    const payload = ids();
    const job = await queue.add("thumbnails", payload);
    await job.waitUntilFinished(events, 10_000);
    expect(received).toEqual([payload]);
    await events.close();
  });

  it("payload rusak → gagal final tanpa retry walau attempts > 1", async () => {
    const { queue, events } = await start({ thumbnails: async () => {} });
    const job = await queue.add("thumbnails", { requestId: "x" }, { attempts: 3 });
    await expect(job.waitUntilFinished(events, 10_000)).rejects.toThrow(/tidak sesuai kontrak/);
    expect((await queue.getJob(job.id ?? ""))?.attemptsMade).toBe(1);
    await events.close();
  });

  it("health: live & ready 200; Bull Board tampil di lokal", async () => {
    const { running: worker, events } = await start({ thumbnails: async () => {} });
    expect((await request(worker.server).get("/health/live")).status).toBe(200);
    const ready = await request(worker.server).get("/health/ready");
    expect(ready.body).toEqual({ status: "ready", checks: { redis: "ok" } });
    const board = await request(worker.server).get("/queues");
    expect(board.status).toBe(200);
    expect(board.text).toMatch(/<html/i);
    await events.close();
  });

  it("Bull Board tidak dipasang di luar lokal", async () => {
    const { running: worker, events } = await start({ thumbnails: async () => {} }, { APP_ENV: "staging" });
    expect((await request(worker.server).get("/queues")).status).toBe(404);
    await events.close();
  });

  it("graceful shutdown menunggu job aktif selesai", async () => {
    let finished = false;
    const {
      running: worker,
      queue,
      events,
    } = await start({
      thumbnails: async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        finished = true;
      },
    });
    const job = await queue.add("thumbnails", ids());
    await expect.poll(async () => (await queue.getJob(job.id ?? ""))?.processedOn).toBeDefined();
    await worker.close("SIGTERM");
    running = undefined;
    expect(finished).toBe(true);
    expect(await (await queue.getJob(job.id ?? ""))?.getState()).toBe("completed");
    await events.close();
  });

  it("job melewati batas shutdown → worker ditutup paksa tanpa menunggu", async () => {
    const {
      running: worker,
      queue,
      events,
    } = await start({ thumbnails: () => new Promise((resolve) => setTimeout(resolve, 5_000)) }, {}, 100);
    const job = await queue.add("thumbnails", ids());
    await expect.poll(async () => (await queue.getJob(job.id ?? ""))?.processedOn).toBeDefined();
    const started = Date.now();
    await worker.close("SIGTERM");
    running = undefined;
    expect(Date.now() - started).toBeLessThan(2_000);
    await events.close();
  });

  it("WORKER_QUEUES dengan queue tanpa processor → gagal start", async () => {
    await expect(start({ thumbnails: async () => {} }, { WORKER_QUEUES: "thumbnails,email" })).rejects.toThrow(
      /tanpa processor: email/,
    );
  });
});
