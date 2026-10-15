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

export const RealtimeStatelessMessageSchema = z.discriminatedUnion("type", [
  RealtimeSavedMessageSchema,
  RealtimeLimitWarningMessageSchema,
]);

export type RealtimeSavedMessage = z.infer<typeof RealtimeSavedMessageSchema>;
export type RealtimeLimitWarningMessage = z.infer<typeof RealtimeLimitWarningMessageSchema>;
export type RealtimeStatelessMessage = z.infer<typeof RealtimeStatelessMessageSchema>;

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
