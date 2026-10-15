import type { LockHolder } from "@platform/shared/contracts";
import type { Redis } from "ioredis";

// Lock pengedit per dokumen di Redis (ARCHITECTURE §5.5): hash `doclock:<docId>` {userId, name} dengan TTL,
// diperpanjang heartbeat. Pemegang = USER (bukan koneksi): tab/perangkat lain user yang sama ikut boleh mengedit
// (ED-201). Setiap operasi satu skrip Lua agar baca-bandingkan-tulis atomik antar instance realtime.

export const lockKey = (docId: string) => `doclock:${docId}`;

// Kosong → ambil; milik user yang sama → perpanjang; milik user lain → kembalikan pemegangnya.
const ACQUIRE = `
local holder = redis.call('HGET', KEYS[1], 'userId')
if (not holder) or holder == ARGV[1] then
  redis.call('HSET', KEYS[1], 'userId', ARGV[1], 'name', ARGV[2])
  redis.call('PEXPIRE', KEYS[1], ARGV[3])
  return {1}
end
return {0, holder, redis.call('HGET', KEYS[1], 'name') or ''}
`;

// Heartbeat = acquire: lock yang kedaluwarsa (mis. instance lain melepas) diambil ulang; milik user lain → hilang.
const HEARTBEAT = ACQUIRE;

// Hanya pemegang yang boleh melepas (lock yang sudah diambil alih tidak ikut terhapus).
const RELEASE = `
if redis.call('HGET', KEYS[1], 'userId') == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

export type AcquireResult = { acquired: true } | { acquired: false; holder: LockHolder };

export class EditorLock {
  constructor(
    private readonly redis: Redis,
    private readonly ttlMs: number,
  ) {}

  async acquire(docId: string, holder: LockHolder): Promise<AcquireResult> {
    return this.parse(await this.redis.eval(ACQUIRE, 1, lockKey(docId), holder.userId, holder.name, this.ttlMs));
  }

  async heartbeat(docId: string, holder: LockHolder): Promise<AcquireResult> {
    return this.parse(await this.redis.eval(HEARTBEAT, 1, lockKey(docId), holder.userId, holder.name, this.ttlMs));
  }

  /** Ambil alih paksa (takeover): pemegang lama kehilangan lock. */
  async takeover(docId: string, holder: LockHolder): Promise<void> {
    await this.redis
      .multi()
      .del(lockKey(docId))
      .hset(lockKey(docId), "userId", holder.userId, "name", holder.name)
      .pexpire(lockKey(docId), this.ttlMs)
      .exec();
  }

  async release(docId: string, userId: string): Promise<void> {
    await this.redis.eval(RELEASE, 1, lockKey(docId), userId);
  }

  async holder(docId: string): Promise<LockHolder | null> {
    const value = await this.redis.hgetall(lockKey(docId));
    return value.userId ? { userId: value.userId, name: value.name ?? "" } : null;
  }

  private parse(raw: unknown): AcquireResult {
    if (!Array.isArray(raw)) throw new Error("respons lock Redis tidak terduga");
    if (raw[0] === 1) return { acquired: true };
    return { acquired: false, holder: { userId: String(raw[1]), name: String(raw[2] ?? "") } };
  }
}
