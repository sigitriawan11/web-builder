import { scrubBreadcrumb, scrubEvent, stripUrl } from "@platform/shared/telemetry";
import * as Sentry from "@sentry/node";

// T1.16.3: Sentry sisi server apps/web (Node runtime Next) — hanya penangkapan error (tanpa OTel/tracing), scrubber
// sama dengan app server lain. apps/web tidak boleh memakai `@platform/shared/node`, jadi init ditulis di sini.

let enabled = false;

export function initWebServerTelemetry(env: Readonly<Record<string, string | undefined>> = process.env): void {
  const dsn = env.SENTRY_DSN;
  if (!dsn || enabled) return;
  Sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT || env.APP_ENV || "local",
    ...(env.SENTRY_RELEASE ? { release: env.SENTRY_RELEASE } : {}),
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.nodeContextIntegration(),
    ],
    skipOpenTelemetrySetup: true,
    initialScope: { tags: { service: "web" } },
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb, "server"),
    beforeSend: (event) => scrubEvent(event, "server"),
  });
  enabled = true;
}

interface RequestInfo {
  path: string;
  method: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
}

interface RequestContext {
  routeType: string;
  routePath: string;
}

/** `onRequestError` Next: error render/route/action/proxy server → Sentry dengan tag rute & request_id. */
export async function reportRequestError(error: unknown, request: RequestInfo, context: RequestContext): Promise<void> {
  if (!enabled) return;
  const requestId = request.headers["x-request-id"];
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : undefined;
  Sentry.withScope((scope) => {
    scope.setTag("route_type", context.routeType);
    scope.setTag("route", context.routePath);
    scope.setTag("method", request.method);
    scope.setTag("path", stripUrl(request.path));
    if (typeof requestId === "string") scope.setTag("request_id", requestId);
    if (digest) scope.setTag("digest", digest);
    Sentry.captureException(error);
  });
  await Sentry.flush(2_000);
}
