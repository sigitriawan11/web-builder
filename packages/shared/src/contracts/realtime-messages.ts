import { z } from "zod";

// Stateless message apps/realtime → editor (Hocuspocus `sendStateless`, string JSON). ARCHITECTURE §7.2, ED-200, DM-076.

const Count = z.number().int().nonnegative();

/**
 * `saved` — update sudah tersimpan di Postgres sampai `seq`. `clocks` = clock Yjs per clientID (key desimal) dari
 * update yang baru disimpan: klien menganggap perubahannya tersimpan bila `clocks[doc.clientID] >= clock lokalnya`
 * (seq saja tidak cukup — update yang masih di jalan saat flush tidak termasuk).
 */
export const RealtimeSavedMessageSchema = z.object({
  type: z.literal("saved"),
  seq: Count,
  clocks: z.record(z.string().regex(/^\d+$/), Count),
});

/** `limit-warning` — state dokumen melewati batas soft (DM-076); dikirim sekali per dokumen. */
export const RealtimeLimitWarningMessageSchema = z.object({
  type: z.literal("limit-warning"),
  limit: z.literal("yDocStateBytes"),
  bytes: Count,
  max: Count,
});

// Single-editor lock (ARCHITECTURE §5.5): satu USER pengedit per dokumen; tab/perangkat lain user yang sama boleh
// (ED-201). Viewer tidak terlibat lock.
export const LockHolderSchema = z.object({ userId: z.string().min(1), name: z.string() });

/** `locked` — dokumen sedang diedit user lain; koneksi ini read-only sampai `takeover` atau `unlocked`. */
export const RealtimeLockedMessageSchema = z.object({ type: z.literal("locked"), holder: LockHolderSchema });
/** `unlocked` — pemegang lock pergi; klien read-only boleh mengirim `takeover` untuk mulai mengedit. */
export const RealtimeUnlockedMessageSchema = z.object({ type: z.literal("unlocked") });
/** `lock-acquired` — koneksi ini kini boleh mengedit (setelah `takeover`). */
export const RealtimeLockAcquiredMessageSchema = z.object({ type: z.literal("lock-acquired") });

export const RealtimeStatelessMessageSchema = z.discriminatedUnion("type", [
  RealtimeSavedMessageSchema,
  RealtimeLimitWarningMessageSchema,
  RealtimeLockedMessageSchema,
  RealtimeUnlockedMessageSchema,
  RealtimeLockAcquiredMessageSchema,
]);

/**
 * Alasan penolakan koneksi realtime (dikirim sebagai `permission-denied` → `onAuthenticationFailed({ reason })` di
 * provider). `schema-unsupported`: dokumen ber-`schemaVersion` lebih baru dari server ini (mis. setelah rollback
 * deploy) — server tidak memuat/menulisnya agar data tidak rusak.
 */
export const REALTIME_DENY_REASONS = { schemaUnsupported: "schema-unsupported" } as const;

/** Pesan editor → realtime. `takeover` = ambil alih edit dari user lain (koneksi pemegang lama jadi read-only). */
export const RealtimeClientMessageSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("takeover") })]);

export type RealtimeSavedMessage = z.infer<typeof RealtimeSavedMessageSchema>;
export type RealtimeLimitWarningMessage = z.infer<typeof RealtimeLimitWarningMessageSchema>;
export type RealtimeStatelessMessage = z.infer<typeof RealtimeStatelessMessageSchema>;
export type LockHolder = z.infer<typeof LockHolderSchema>;
export type RealtimeClientMessage = z.infer<typeof RealtimeClientMessageSchema>;

/** Parse payload stateless; payload asing/rusak → `null` (diabaikan klien, bukan error). */
export function parseRealtimeStatelessMessage(payload: string): RealtimeStatelessMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }
  const parsed = RealtimeStatelessMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Parse pesan klien di server; payload asing/rusak → `null` (diabaikan). */
export function parseRealtimeClientMessage(payload: string): RealtimeClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }
  const parsed = RealtimeClientMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
