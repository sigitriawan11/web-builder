import { scrubBreadcrumb, scrubEvent } from "@platform/shared/telemetry";
import * as Sentry from "@sentry/react";

// ED-231: pelaporan error editor ke Sentry. Tanpa `VITE_SENTRY_DSN` (dev lokal) semua fungsi no-op kecuali log.
// Tag: `site` & user = hash (bukan ID mentah), `request_id` dari error api, `error_id` = ID yang ditampilkan ke user.

let enabled = false;

export function initTelemetry(env: ImportMetaEnv = import.meta.env): void {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn || enabled) return;
  Sentry.init({
    dsn,
    environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE,
    ...(env.VITE_RELEASE ? { release: env.VITE_RELEASE } : {}),
    sendDefaultPii: false,
    // Performance sampling (ED-231); replay sengaja tidak dipakai (merekam konten canvas).
    tracesSampleRate: Number(env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
    beforeSend: (event) => scrubEvent(event),
  });
  enabled = true;
}

export const telemetryEnabled = () => enabled;

/** SHA-256 heksadesimal 16 karakter: korelasi antar event tanpa mengirim ID asli. */
export async function hashId(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Konteks sesi editor (situs & user) sebagai hash. */
export async function setTelemetryScope(scope: { siteId: string; userId?: string | undefined }): Promise<void> {
  if (!enabled) return;
  Sentry.setTag("site", await hashId(scope.siteId));
  if (scope.userId) Sentry.setUser({ id: await hashId(scope.userId) });
}

export interface ReportContext {
  // Di mana error terjadi: "app", "node", "panel:<nama>", …
  area: string;
  errorId?: string;
  requestId?: string;
}

function requestIdOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "requestId" in error) {
    const { requestId } = error as { requestId: unknown };
    return typeof requestId === "string" ? requestId : undefined;
  }
  return undefined;
}

export function reportError(error: unknown, context: ReportContext): void {
  console.error(`editor: [${context.area}]${context.errorId ? ` [${context.errorId}]` : ""}`, error);
  if (!enabled) return;
  const requestId = context.requestId ?? requestIdOf(error);
  Sentry.withScope((scope) => {
    scope.setTag("area", context.area);
    if (context.errorId) scope.setTag("error_id", context.errorId);
    if (requestId) scope.setTag("request_id", requestId);
    Sentry.captureException(error);
  });
}

/** Breadcrumb aksi editor: nama aksi + jenis origin saja, tidak pernah isi dokumen. */
export function recordEditorAction(action: string, origin?: string): void {
  if (!enabled) return;
  Sentry.addBreadcrumb({ category: "editor", level: "info", data: { action, ...(origin ? { origin } : {}) } });
}
