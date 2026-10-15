import { eq, schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import { REDACTED } from "@platform/shared/contracts";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeadLetterProcessor } from "../processors/dead-letter/dead-letter.processor";
import { createWorkerLogger } from "../worker-process";
import { type RunningWorkers, startWorkers } from "./workers";

// T1.13.3: job gagal final di queue mana pun → queue `dead-letter` → tabel `dead_letter_jobs` (Redis + Postgres asli).
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const logger = createWorkerLogger({ APP_ENV: "local", LOG_LEVEL: "fatal" }, { write: () => {} });
// Prefix sendiri: tidak bercampur dengan antrean dev owner.
const prefix = `test-dlq-${uuidv7()}`;

let testDb: TestDb;
let workers: RunningWorkers;
let emailQueue: Queue;
let redis: Redis;
// Job email: gagal untuk userId di `failing` (selalu) atau `flaky` (sekali saja).
const failing = new Set<string>();
const flaky = new Set<string>();

beforeAll(async () => {
  testDb = await createTestDb();
  redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  emailQueue = new Queue("email", { connection: redis, prefix });
  workers = startWorkers({
    redisUrl,
    prefix,
    logger,
    queues: ["email", "dead-letter"],
    processors: {
      email: async (payload) => {
        if (failing.has(payload.userId)) throw new Error("SMTP menolak");
        if (flaky.delete(payload.userId)) throw new Error("timeout sesaat");
      },
      "dead-letter": createDeadLetterProcessor({ db: testDb.db }),
    },
  });
});
afterAll(async () => {
  await workers.close(2_000);
  await emailQueue.obliterate({ force: true });
  await new Queue("dead-letter", { connection: redis, prefix }).obliterate({ force: true });
  await emailQueue.close();
  redis.disconnect();
  await testDb.drop();
});

async function deadLetters(jobId: string) {
  return testDb.db.select().from(schema.deadLetterJobs).where(eq(schema.deadLetterJobs.jobId, jobId));
}

const verifyJob = (userId: string) => ({
  requestId: `req-${uuidv7()}`,
  template: "auth.verify_email" as const,
  userId,
  verifyUrl: "http://app.localhost:3000/verify?token=rahasia",
});

describe("dead-letter", () => {
  it("gagal di semua percobaan → satu baris DLQ (attempts, error, payload tersensor) (AC T1.13.3)", async () => {
    const userId = uuidv7();
    failing.add(userId);
    const data = verifyJob(userId);
    const job = await emailQueue.add("auth.verify_email", data, { attempts: 2, backoff: { type: "fixed", delay: 50 } });

    await expect.poll(() => deadLetters(job.id ?? ""), { timeout: 10_000 }).toHaveLength(1);
    const [row] = await deadLetters(job.id ?? "");
    expect(row).toMatchObject({
      queue: "email",
      jobName: "auth.verify_email",
      attempts: 2,
      requestId: data.requestId,
      status: "open",
      error: expect.objectContaining({ message: "SMTP menolak" }),
      payload: { ...data, verifyUrl: REDACTED },
    });
    expect(JSON.stringify(row?.payload)).not.toContain("rahasia");
  });

  it("payload melanggar kontrak → tidak di-retry, langsung DLQ walau attempts 3", async () => {
    const job = await emailQueue.add("rusak", { requestId: "req-rusak", template: "tidak-ada" }, { attempts: 3 });
    await expect.poll(() => deadLetters(job.id ?? ""), { timeout: 10_000 }).toHaveLength(1);
    expect((await deadLetters(job.id ?? ""))[0]).toMatchObject({ attempts: 1, requestId: "req-rusak" });
  });

  it("gagal sekali lalu berhasil pada retry → tidak masuk DLQ", async () => {
    const userId = uuidv7();
    flaky.add(userId);
    const job = await emailQueue.add("auth.verify_email", verifyJob(userId), {
      attempts: 2,
      backoff: { type: "fixed", delay: 50 },
    });
    await expect
      .poll(async () => (await emailQueue.getJob(job.id ?? ""))?.finishedOn, { timeout: 10_000 })
      .toBeTruthy();
    expect(await (await emailQueue.getJob(job.id ?? ""))?.getState()).toBe("completed");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await deadLetters(job.id ?? "")).toEqual([]);
  });
});
