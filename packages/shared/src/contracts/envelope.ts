import { z } from "zod";

// Envelope response Platform & Runtime API (ARCHITECTURE §5.3). Dipakai api untuk membentuk response
// dan sdk untuk mem-parse response di web/editor.

export const ResponseMetaSchema = z.object({
  requestId: z.string().min(1),
});

export const ListMetaSchema = ResponseMetaSchema.extend({
  // `null` = halaman terakhir.
  nextCursor: z.string().min(1).nullable(),
});

/** `{ data, meta }` untuk satu resource. */
export function dataEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data, meta: ResponseMetaSchema });
}

/** `{ data: [...], meta: { nextCursor, requestId } }` untuk daftar ber-cursor. */
export function listEnvelope<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), meta: ListMetaSchema });
}

// `code` sengaja string UPPER_SNAKE, bukan enum katalog: island JS di situs yang sudah dipublish memakai SDK lama
// dan harus tetap bisa membaca kode baru dari server (Runtime API stabil, ARCHITECTURE §5.3).
export const ErrorBodySchema = z.object({
  error: z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().min(1),
  }),
});

export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;
export type ListMeta = z.infer<typeof ListMetaSchema>;
export type ErrorBody = z.infer<typeof ErrorBodySchema>;
