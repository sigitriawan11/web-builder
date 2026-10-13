import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

// Konteks request/job yang ikut ke semua kode async di bawahnya (ARCHITECTURE §13): requestId dibuat di edge
// pertama, lalu middleware api mengisi user & tenant; worker memulai konteks dari payload job.
// `node:async_hooks` tersedia di Node dan Cloudflare Workers (`nodejs_compat`).

export const RequestContextSchema = z.object({
  requestId: z.string().min(1),
  userId: z.string().min(1).optional(),
  workspaceId: z.string().min(1).optional(),
  siteId: z.string().min(1).optional(),
  jobId: z.string().min(1).optional(),
});

export type RequestContext = z.infer<typeof RequestContextSchema>;

const storage = new AsyncLocalStorage<RequestContext>();

/** Jalankan `fn` dengan konteks baru; konteks luar (bila ada) tidak berubah. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run({ ...RequestContextSchema.parse(context) }, fn);
}

export function getContext(): Readonly<RequestContext> | undefined {
  return storage.getStore();
}

/**
 * Lengkapi konteks aktif (mis. `userId` setelah authSession, `workspaceId`/`siteId` setelah tenantResolver).
 * Berlaku untuk sisa request ini saja. Di luar konteks → error, agar bug urutan middleware langsung terlihat.
 */
export function updateContext(patch: Partial<Omit<RequestContext, "requestId">>): void {
  const current = storage.getStore();
  if (!current) throw new Error("updateContext dipanggil di luar runWithContext");
  Object.assign(current, RequestContextSchema.omit({ requestId: true }).partial().parse(patch));
}

/** Field log dari konteks aktif — dipasang sebagai `mixin` logger (`createLogger({ mixin: contextLogFields })`). */
export function contextLogFields(): Record<string, string> {
  const context = storage.getStore();
  if (!context) return {};
  return Object.fromEntries(
    Object.entries(context).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
