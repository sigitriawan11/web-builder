import * as Y from "yjs";
import { z } from "zod";
import { YDOC_KEYS } from "./mapping";

// DM-060: origin transaksi. Yjs membandingkan origin per REFERENSI (trackedOrigins UndoManager), jadi setiap sumber
// memakai satu instance objek: user = satu objek per sesi (dipegang editor), AI = satu objek per run (cache di sini),
// system/remote = singleton.

export const TxOriginSchema = z.discriminatedUnion("kind", [
  // label: "Ubah warna" — untuk history panel.
  z.strictObject({ kind: z.literal("user"), sessionId: z.string().min(1), label: z.string().optional() }),
  z.strictObject({ kind: z.literal("ai"), runId: z.string().min(1), stepLabel: z.string().optional() }),
  z.strictObject({
    kind: z.literal("system"),
    reason: z.enum(["migration", "repair", "componentUpdate", "gc", "import"]),
  }),
  // Update dari provider (Hocuspocus) / kolaborator.
  z.strictObject({ kind: z.literal("remote") }),
]);

export type TxOrigin = z.infer<typeof TxOriginSchema>;
export type SystemReason = Extract<TxOrigin, { kind: "system" }>["reason"];

/** Origin user untuk satu sesi editor; pemanggil menyimpan instance ini dan memakainya untuk semua command. */
export function userOrigin(sessionId: string, label?: string): Extract<TxOrigin, { kind: "user" }> {
  return label === undefined ? { kind: "user", sessionId } : { kind: "user", sessionId, label };
}

const aiOrigins = new Map<string, Extract<TxOrigin, { kind: "ai" }>>();

/** Origin satu run AI (notasi dokumen lain: `ai:<runId>`); instance sama untuk runId yang sama. */
export function aiOrigin(runId: string): Extract<TxOrigin, { kind: "ai" }> {
  let origin = aiOrigins.get(runId);
  if (!origin) {
    origin = Object.freeze({ kind: "ai", runId });
    aiOrigins.set(runId, origin);
  }
  return origin;
}

/** Lepas cache origin run yang sudah selesai (setelah diterapkan/dibuang dan tidak lagi di stack undo). */
export function releaseAiOrigin(runId: string): void {
  aiOrigins.delete(runId);
}

const systemOrigins = new Map<SystemReason, Extract<TxOrigin, { kind: "system" }>>();

export function systemOrigin(reason: SystemReason): Extract<TxOrigin, { kind: "system" }> {
  let origin = systemOrigins.get(reason);
  if (!origin) {
    origin = Object.freeze({ kind: "system", reason });
    systemOrigins.set(reason, origin);
  }
  return origin;
}

export const REMOTE_ORIGIN: Extract<TxOrigin, { kind: "remote" }> = Object.freeze({ kind: "remote" });

export type OriginDescription = {
  kind: TxOrigin["kind"] | "unknown";
  aiRunId?: string;
  label?: string;
};

/**
 * Ringkasan origin untuk penyimpanan (`document_updates.origin` + `ai_run_id`) dan label history. Origin non-DM-060
 * (mis. plugin key y-tiptap atau provider) → `unknown`; pemanggil memetakan sesuai konteksnya.
 */
export function describeOrigin(origin: unknown): OriginDescription {
  const parsed = TxOriginSchema.safeParse(origin);
  if (!parsed.success) return { kind: "unknown" };
  const value = parsed.data;
  switch (value.kind) {
    case "user":
      return value.label === undefined ? { kind: "user" } : { kind: "user", label: value.label };
    case "ai":
      return value.stepLabel === undefined
        ? { kind: "ai", aiRunId: value.runId }
        : { kind: "ai", aiRunId: value.runId, label: value.stepLabel };
    case "system":
      return { kind: "system", label: value.reason };
    case "remote":
      return { kind: "remote" };
  }
}

/** Semua root type dokumen — cakupan UndoManager agar edit theme/settings juga bisa di-undo. */
export function undoScope(doc: Y.Doc): Array<Y.Map<unknown> | Y.Array<unknown>> {
  return Object.values(YDOC_KEYS).map((key) =>
    key === YDOC_KEYS.pageOrder ? doc.getArray<unknown>(key) : doc.getMap<unknown>(key),
  );
}

/** Jendela penggabungan langkah undo (DM-060/ED-197): edit beruntun < 500 ms = satu langkah. */
export const UNDO_CAPTURE_TIMEOUT_MS = 500;

/**
 * UndoManager dokumen: hanya `localOrigins` yang dilacak (user sesi ini + run AI yang diterapkan lewat
 * `applyDraft`); `system` & `remote` tidak pernah di-undo. Setiap langkah menyimpan meta `origin`
 * (`describeOrigin`) untuk label history panel.
 */
export function createDocumentUndoManager(
  doc: Y.Doc,
  localOrigins: Iterable<unknown>,
  options: { captureTimeout?: number } = {},
): Y.UndoManager {
  const manager = new Y.UndoManager(undoScope(doc), {
    trackedOrigins: new Set(localOrigins),
    captureTimeout: options.captureTimeout ?? UNDO_CAPTURE_TIMEOUT_MS,
  });
  manager.on("stack-item-added", (event: { stackItem: { meta: Map<unknown, unknown> }; origin: unknown }) => {
    if (!event.stackItem.meta.has("origin")) event.stackItem.meta.set("origin", describeOrigin(event.origin));
  });
  return manager;
}
