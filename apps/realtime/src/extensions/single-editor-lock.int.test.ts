import type { Server } from "@hocuspocus/server";
import { createTestDb, createUser, type TestDb } from "@platform/db/testing";
import { uuidv7 } from "@platform/shared";
import { createLogger } from "@platform/shared/node";
import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { connectClient, sleep, type TestClient, waitFor } from "../../test/realtime-client";
import type { RealtimeContext } from "../auth";
import { EditorLock, lockKey } from "../lock/editor-lock";
import { createRealtimeServer } from "../server";
import { SingleEditorLockExtension } from "./single-editor-lock";

// T1.12.6: single-editor lock per USER (keputusan owner; ARCHITECTURE §5.5, ED-201) dengan Redis & Postgres asli.
const SECRET = "test-realtime-secret-0123456789abcdef";
const TTL_MS = 5_000;
const logger = createLogger({ service: "realtime-test", env: "test", level: "silent" });

let testDb: TestDb;
let redis: Redis;
let server: Server<RealtimeContext>;
let extension: SingleEditorLockExtension;
let url: string;
const clients: TestClient[] = [];

beforeAll(async () => {
  testDb = await createTestDb();
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL kosong — jalankan lewat `pnpm test:integration` (memuat .env root).");
  redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  // Heartbeat otomatis dimatikan (interval panjang): test memanggil `heartbeat()` langsung.
  extension = new SingleEditorLockExtension({
    lock: new EditorLock(redis, TTL_MS),
    db: testDb.db,
    logger,
    heartbeatMs: 60_000,
  });
  server = createRealtimeServer({ port: 0, host: "127.0.0.1", tokenSecret: SECRET, logger, lock: extension });
  await server.listen();
  url = `ws://127.0.0.1:${server.address.port}`;
});
afterEach(() => {
  for (const client of clients.splice(0)) client.provider.destroy();
});
afterAll(async () => {
  await server.destroy();
  await redis.quit();
  await testDb.drop();
});

// Dokumen tanpa persistence: Hocuspocus memulai Y.Doc kosong — yang diuji hanya lock.
const newDocId = () => uuidv7();

async function user(name: string) {
  return (await createUser(testDb.db, { name })).user;
}

async function connect(userId: string, docId: string, role: "owner" | "editor" | "viewer" = "editor") {
  const client = await connectClient({ url, secret: SECRET, userId, docId, siteId: null, role });
  clients.push(client);
  return client;
}

/** Tulis dari `from`; kembalikan apakah `to` menerimanya (server menolak update dari koneksi read-only). */
async function propagates(from: TestClient, to: TestClient, key: string): Promise<boolean> {
  from.doc.getMap("test").set(key, true);
  try {
    await waitFor(() => to.doc.getMap("test").get(key) === true, 500);
    return true;
  } catch {
    return false;
  }
}

describe("single-editor lock", () => {
  it("pengedit kedua dari user LAIN → `locked` (nama pemegang) & read-only; viewer tidak terlibat", async () => {
    const sari = await user("Sari Wulandari");
    const budi = await user("Budi Santoso");
    const docId = newDocId();
    const holder = await connect(sari.id, docId);
    const other = await connect(budi.id, docId);
    const viewer = await connect(budi.id, docId, "viewer");

    await waitFor(() => other.messages("locked").length === 1);
    expect(other.messages("locked")[0]).toEqual({
      type: "locked",
      holder: { userId: sari.id, name: "Sari Wulandari" },
    });
    expect(holder.messages("locked")).toEqual([]);
    expect(viewer.messages("locked")).toEqual([]);
    expect(await redis.hgetall(lockKey(docId))).toEqual({ userId: sari.id, name: "Sari Wulandari" });

    expect(await propagates(holder, other, "dariSari")).toBe(true);
    expect(await propagates(other, holder, "dariBudi")).toBe(false);
  });

  it("tab/perangkat lain user yang SAMA tetap boleh mengedit (ED-201)", async () => {
    const sari = await user("Sari");
    const docId = newDocId();
    const tab1 = await connect(sari.id, docId);
    const tab2 = await connect(sari.id, docId);
    await sleep(100);
    expect(tab2.messages("locked")).toEqual([]);
    expect(await propagates(tab2, tab1, "tab2")).toBe(true);
    expect(await propagates(tab1, tab2, "tab1")).toBe(true);
  });

  it("takeover → pengambil alih boleh mengedit (`lock-acquired`), pemegang lama read-only + `locked`", async () => {
    const sari = await user("Sari");
    const budi = await user("Budi");
    const docId = newDocId();
    const old = await connect(sari.id, docId);
    const taker = await connect(budi.id, docId);
    await waitFor(() => taker.messages("locked").length === 1);

    taker.send({ type: "takeover" });
    await waitFor(() => taker.messages("lock-acquired").length === 1);
    await waitFor(() => old.messages("locked").length === 1);
    expect(old.messages("locked")[0]?.holder).toEqual({ userId: budi.id, name: "Budi" });
    expect(await redis.hget(lockKey(docId), "userId")).toBe(budi.id);

    expect(await propagates(taker, old, "dariBudi")).toBe(true);
    expect(await propagates(old, taker, "dariSari")).toBe(false);
  });

  it("viewer tidak bisa takeover; pesan klien asing diabaikan", async () => {
    const sari = await user("Sari");
    const budi = await user("Budi");
    const docId = newDocId();
    await connect(sari.id, docId);
    const viewer = await connect(budi.id, docId, "viewer");
    viewer.send({ type: "takeover" });
    viewer.send({ type: "lainnya" });
    await sleep(200);
    expect(await redis.hget(lockKey(docId), "userId")).toBe(sari.id);
    expect(viewer.messages("lock-acquired")).toEqual([]);
  });

  it("pemegang putus (koneksi terakhirnya) → lock dilepas & pengedit yang menunggu menerima `unlocked`", async () => {
    const sari = await user("Sari");
    const budi = await user("Budi");
    const docId = newDocId();
    const tab1 = await connect(sari.id, docId);
    const tab2 = await connect(sari.id, docId);
    const waiting = await connect(budi.id, docId);
    await waitFor(() => waiting.messages("locked").length === 1);

    // Satu tab Sari masih ada → lock tetap.
    tab1.provider.destroy();
    await sleep(200);
    expect(await redis.exists(lockKey(docId))).toBe(1);
    expect(waiting.messages("unlocked")).toEqual([]);

    tab2.provider.destroy();
    await waitFor(() => waiting.messages("unlocked").length === 1);
    expect(await redis.exists(lockKey(docId))).toBe(0);

    // Lock bebas: takeover tidak merebut dari siapa pun.
    waiting.send({ type: "takeover" });
    await waitFor(() => waiting.messages("lock-acquired").length === 1);
  });

  it("heartbeat memperpanjang TTL; lock direbut lewat instance lain → pemegang di sini jadi read-only", async () => {
    const sari = await user("Sari");
    const budi = await user("Budi");
    const docId = newDocId();
    const holder = await connect(sari.id, docId);
    const other = await connect(budi.id, docId);
    await redis.pexpire(lockKey(docId), 1_000);
    await extension.heartbeat();
    expect(await redis.pttl(lockKey(docId))).toBeGreaterThan(TTL_MS - 1_000);

    // Instance lain: user ketiga mengambil alih langsung di Redis.
    const rina = await user("Rina");
    await new EditorLock(redis, TTL_MS).takeover(docId, { userId: rina.id, name: "Rina" });
    await extension.heartbeat();
    await waitFor(() => holder.messages("locked").length === 1);
    expect(holder.messages("locked")[0]?.holder).toEqual({ userId: rina.id, name: "Rina" });
    expect(await propagates(holder, other, "dariSari")).toBe(false);
  });
});
