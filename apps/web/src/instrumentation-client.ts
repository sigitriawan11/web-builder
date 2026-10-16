import { scrubBreadcrumb, scrubEvent } from "@platform/shared/telemetry";
import * as Sentry from "@sentry/react";

// ARCHITECTURE §13 (T1.16.3): Sentry browser apps/web (dashboard, auth, admin, marketing). Tanpa DSN = nonaktif.
// Scrubber sama dengan editor: tanpa klik/input/console, URL tanpa query, UUID → `:id`, tanpa replay.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    ...(process.env.NEXT_PUBLIC_SENTRY_RELEASE ? { release: process.env.NEXT_PUBLIC_SENTRY_RELEASE } : {}),
    sendDefaultPii: false,
    initialScope: { tags: { service: "web" } },
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
    beforeSend: (event) => scrubEvent(event),
  });
}
