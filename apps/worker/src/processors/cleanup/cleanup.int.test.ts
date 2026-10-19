import { createServer } from "node:net";
import { eq, schema } from "@platform/db";
import { createSite, createTestDb, createUser, type TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadWorkerEnv } from "../../config/env";
import { cleanupSchedulerId, SCHEDULE_TIMEZONE } from "../../runtime/schedules";
import { createWorkerLogger, startWorkerProcess } from "../../worker-process";
import { createCleanupProcessor } from "./cleanup.processor";
import { countCompactionCandidates } from "./cleanup.repository";

// T1.13.4: kerangka queue `cleanup` — jadwal berulang terdaftar & tugas compaction menghitung kandidat.
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

let testDb: TestDb;
let connection: Redis;
beforeAll(async () => {
  testDb = await createTestDb();
  connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
});
afterAll(async () => {
  connection.disconnect();
  await testDb.drop();
});

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

async function bootWorker(prefix: string, cron: string) {
  const env = loadWorkerEnv({
    APP_ENV: "local",
    REDIS_URL: redisUrl,
    WORKER_HEALTH_PORT: String(await freePort()),
    WORKER_QUEUES: "cleanup",
    DATABASE_URL: "postgres://unused@localhost:5432/unused",
    SMTP_URL: "smtp://localhost:1025",
    EMAIL_FROM: "Platform <no-reply@platformmu.com>",
    PUBLIC_APP_URL: "http://app.localhost:3000",
    // S3 wajib di schema env worker (processor image-processing); tak dipakai test ini.
    S3_ENDPOINT: "http://localhost:9000",
    S3_ACCESS_KEY_ID: "minioadmin",
    S3_SECRET_ACCESS_KEY: "minioadmin",
    CLEANUP_COMPACTION_CRON: cron,
  });
  const logger = createWorkerLogger({ APP_ENV: "local", LOG_LEVEL: "fatal" }, { write: () => {} });
  return startWorkerProcess(env, { logger, prefix, processors: { cleanup: async () => {} } });
}

describe("jadwal cleanup", () => {
  it("worker yang menjalankan `cleanup` mendaftarkan job berulang dari env; boot ulang tidak menggandakan (AC T1.13.4)", async () => {
    const prefix = `test-cleanup-${uuidv7()}`;
    const queue = new Queue("cleanup", { connection, prefix });
    try {
      await (await bootWorker(prefix, "0 3 * * *")).close("test");
      // Instance kedua / boot ulang dengan jadwal baru → tetap satu scheduler, pola diperbarui.
      await (await bootWorker(prefix, "30 2 * * *")).close("test");
      const schedulers = await queue.getJobSchedulers();
      expect(schedulers).toHaveLength(1);
      expect(schedulers[0]).toMatchObject({
        key: cleanupSchedulerId("compact-documents"),
        pattern: "30 2 * * *",
        tz: SCHEDULE_TIMEZONE,
        template: { data: { requestId: "scheduler:compact-documents", task: "compact-documents" } },
      });
      expect(await queue.getDelayedCount()).toBe(1);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});

describe("tugas compact-documents (kerangka M1)", () => {
  it("menghitung update yang sudah tercakup snapshot terbaru, tanpa menghapus apa pun", async () => {
    const { workspace } = await createUser(testDb.db);
    const { document } = await createSite(testDb.db, { workspace });
    await testDb.db.insert(schema.documentUpdates).values(
      [1, 2, 3].map((seq) => ({
        documentId: document.id,
        seq,
        update: new Uint8Array([seq]),
        origin: "local" as const,
      })),
    );
    const [snapshot] = await testDb.db
      .insert(schema.documentSnapshots)
      .values({ documentId: document.id, uptoSeq: 2, state: new Uint8Array([0]), kind: "auto" })
      .returning();
    await testDb.db
      .update(schema.documents)
      .set({ lastSnapshotId: snapshot?.id, lastSeq: 3 })
      .where(eq(schema.documents.id, document.id));

    expect(await countCompactionCandidates(testDb.db)).toEqual({ documents: 1, updates: 2 });

    const lines: string[] = [];
    const logger = createWorkerLogger({ APP_ENV: "local", LOG_LEVEL: "info" }, { write: (line) => lines.push(line) });
    await createCleanupProcessor({ db: testDb.db })(
      { requestId: "scheduler:compact-documents", task: "compact-documents" },
      { jobId: "j1", attempt: 1, signal: new AbortController().signal, logger },
    );
    expect(lines.some((line) => line.includes('"documents":1') && line.includes('"updates":2'))).toBe(true);
    const rows = await testDb.db.select().from(schema.documentUpdates);
    expect(rows.filter((row) => row.documentId === document.id)).toHaveLength(3);
  });
});
