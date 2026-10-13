import type { Logger } from "@platform/shared/node";
import type { RequestHandler } from "express";

// Readiness (ARCHITECTURE §13): DB, Redis, object storage terjangkau. Dipakai orchestrator container & uptime
// monitor. Response hanya `ok`/`fail` per pengecekan; alasan kegagalan ke log, bukan ke klien.

export type ReadinessCheck = () => Promise<void>;
export const CHECK_TIMEOUT_MS = 2_000;

function withTimeout(check: ReadinessCheck, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${timeoutMs} ms`)), timeoutMs);
    check().then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function readinessHandler(
  checks: Readonly<Record<string, ReadinessCheck>>,
  deps: { logger: Logger; timeoutMs?: number },
): RequestHandler {
  return async (_req, res) => {
    const entries = Object.entries(checks);
    const results = await Promise.allSettled(
      entries.map(([, check]) => withTimeout(check, deps.timeoutMs ?? CHECK_TIMEOUT_MS)),
    );
    const statuses: Record<string, "ok" | "fail"> = {};
    results.forEach((result, index) => {
      const name = entries[index]?.[0] ?? `check${index}`;
      statuses[name] = result.status === "fulfilled" ? "ok" : "fail";
      if (result.status === "rejected") deps.logger.warn({ check: name, err: result.reason }, "readiness check gagal");
    });
    const ready = Object.values(statuses).every((status) => status === "ok");
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", checks: statuses });
  };
}

/** Storage S3-compatible (MinIO lokal / R2): terjangkau bila endpoint menjawab HTTP < 500 (403 tanpa auth = hidup). */
export function storageCheck(endpoint: string): ReadinessCheck {
  return async () => {
    const response = await fetch(endpoint, { method: "GET", signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    await response.body?.cancel();
    if (response.status >= 500) throw new Error(`storage HTTP ${response.status}`);
  };
}
