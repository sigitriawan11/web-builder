import * as Sentry from "@sentry/node";
import { scrubBreadcrumb, scrubEvent, stripUrl } from "../telemetry";

// ARCHITECTURE §13 (T1.16.3): Sentry untuk app server (api, worker, realtime). Hanya penangkapan error — tanpa
// tracing/instrumentasi otomatis OpenTelemetry (perlu preload ESM & menambah overhead; performance = P1).
// PII minimal: header/cookie/body request, user, dan query string tidak pernah dikirim; ID mentah (UUID) di URL/path
// diganti `:id`. Tag: `service`, `request_id`, tag tambahan per error (mis. `queue`, `job`, `doc`).

export type ServerService = "api" | "worker" | "realtime";

export interface ServerTelemetryOptions {
  service: ServerService;
  dsn?: string | undefined;
  environment?: string | undefined;
  // Git SHA (CI); release yang sama dipakai upload source map.
  release?: string | undefined;
  // Untuk test: transport/opsi Sentry tambahan.
  sentryOptions?: Partial<Sentry.NodeOptions>;
}

export interface ServerReporter {
  /** Laporkan error tak terduga; `tags` = string pendek non-PII (request_id, queue, …). */
  report(error: unknown, tags?: Readonly<Record<string, string | undefined>>): void;
  /** Kirim event yang tertunda (dipanggil saat shutdown). */
  flush(timeoutMs?: number): Promise<boolean>;
  readonly enabled: boolean;
}

/** Path/URL tanpa query & fragment dan tanpa UUID mentah. */
export const redactPath = stripUrl;

/** Scrubber event server (header/cookie/body request, user, extra, breadcrumb console dibuang). */
export const scrubServerEvent = <T extends Sentry.ErrorEvent>(event: T): T => scrubEvent(event, "server");

/** Reporter dari env app (`telemetryEnvSchema`); environment default = APP_ENV. */
export function telemetryFromEnv(
  service: ServerService,
  env: {
    APP_ENV: string;
    SENTRY_DSN?: string | undefined;
    SENTRY_ENVIRONMENT?: string | undefined;
    SENTRY_RELEASE?: string | undefined;
  },
): ServerReporter {
  return initServerTelemetry({
    service,
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.APP_ENV,
    release: env.SENTRY_RELEASE,
  });
}

const DISABLED: ServerReporter = { report: () => {}, flush: async () => true, enabled: false };

/**
 * Inisialisasi Sentry sekali per proses. Tanpa DSN (dev lokal) → reporter no-op (error tetap dicatat logger app).
 */
export function initServerTelemetry(options: ServerTelemetryOptions): ServerReporter {
  if (!options.dsn) return DISABLED;
  const client = Sentry.init({
    dsn: options.dsn,
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.release ? { release: options.release } : {}),
    sendDefaultPii: false,
    // Hanya integrasi penangkap error & konteks; tanpa auto-instrumentasi OTel/HTTP.
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.nodeContextIntegration(),
    ],
    skipOpenTelemetrySetup: true,
    initialScope: { tags: { service: options.service } },
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb, "server"),
    beforeSend: (event) => scrubServerEvent(event),
    ...options.sentryOptions,
  });
  return {
    enabled: true,
    report(error, tags = {}) {
      Sentry.withScope((scope) => {
        for (const [key, value] of Object.entries(tags)) if (value) scope.setTag(key, redactPath(value));
        Sentry.captureException(error);
      });
    },
    flush: async (timeoutMs = 2_000) => (client ? await client.flush(timeoutMs) : true),
  };
}
