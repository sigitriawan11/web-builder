import { randomBytes } from "node:crypto";
import { schema } from "@platform/db";
import { createTestDb, type TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import { createLogger } from "@platform/shared/node";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createQueueProducer } from "./producer";
import { withTransaction } from "./with-transaction";

// T1.4.8: job hanya masuk antrean setelah transaksi commit (Postgres & Redis asli). Prefix BullMQ unik per run.
const prefix = `bull-test-${randomBytes(4).toString("hex")}`;
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const producer = createQueueProducer(redisUrl, { prefix });
const inspector = new Queue("publish", { connection: new Redis(redisUrl, { maxRetriesPerRequest: null }), prefix });
const logLines: Record<string, unknown>[] = [];
const logger = createLogger({
  service: "api",
  env: "test",
  destination: { write: (line: string) => void logLines.push(JSON.parse(line)) },
});

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await inspector.obliterate({ force: true });
  await inspector.close();
  await producer.close();
  await testDb.drop();
});

const publishPayload = () => ({ requestId: "req-1", siteId: uuidv7(), deploymentId: uuidv7() });
const jobsFor = async (deploymentId: string) =>
  (await inspector.getJobs(["waiting", "delayed", "active"])).filter((job) => job.data.deploymentId === deploymentId);
const auditCount = async (action: string) =>
  testDb.db.$count(schema.auditLogs, (await import("drizzle-orm")).eq(schema.auditLogs.action, action));

describe("enqueue setelah commit (ARCHITECTURE §18)", () => {
  it("transaksi commit → data tersimpan & job masuk antrean dengan payload tervalidasi + retensi", async () => {
    const payload = publishPayload();
    await withTransaction(testDb.db, logger, async (tx, afterCommit) => {
      await tx.insert(schema.auditLogs).values({ actorType: "system", action: "test.commit" });
      afterCommit(() => producer.enqueue("publish", payload));
    });
    expect(await auditCount("test.commit")).toBe(1);
    const [job] = await jobsFor(payload.deploymentId);
    expect(job?.data).toEqual(payload);
    expect(job?.opts.removeOnComplete).toEqual({ age: 86_400, count: 1_000 });
  });

  it("transaksi rollback → data tidak tersimpan & job TIDAK masuk antrean", async () => {
    const payload = publishPayload();
    await expect(
      withTransaction(testDb.db, logger, async (tx, afterCommit) => {
        await tx.insert(schema.auditLogs).values({ actorType: "system", action: "test.rollback" });
        afterCommit(() => producer.enqueue("publish", payload));
        throw new Error("gagal di tengah transaksi");
      }),
    ).rejects.toThrow("gagal di tengah transaksi");
    expect(await auditCount("test.rollback")).toBe(0);
    expect(await jobsFor(payload.deploymentId)).toHaveLength(0);
  });

  it("payload tidak sesuai kontrak ditolak sebelum masuk antrean", async () => {
    await expect(producer.enqueue("publish", { requestId: "r", siteId: "bukan-uuid" } as never)).rejects.toThrow();
  });

  it("enqueue gagal setelah commit (Redis mati) → request tetap sukses, kegagalan tercatat di log", async () => {
    const deadProducer = createQueueProducer("redis://127.0.0.1:1", { prefix, timeoutMs: 300 });
    const started = Date.now();
    const result = await withTransaction(testDb.db, logger, async (tx, afterCommit) => {
      await tx.insert(schema.auditLogs).values({ actorType: "system", action: "test.redis-down" });
      afterCommit(() => deadProducer.enqueue("publish", publishPayload()));
      return "ok";
    });
    expect(result).toBe("ok");
    // Tidak menggantung: selesai sesuai batas waktu enqueue.
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(await auditCount("test.redis-down")).toBe(1);
    expect(logLines.some((line) => line.msg === "efek afterCommit gagal setelah transaksi commit")).toBe(true);
    await deadProducer.close();
  });
});
