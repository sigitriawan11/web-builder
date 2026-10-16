import type { Instrumentation } from "next";

// ARCHITECTURE §13 (T1.16.3): observability server apps/web. Hanya runtime Node (proxy/edge tidak memakai Sentry Node).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initWebServerTelemetry } = await import("./lib/telemetry/server");
  initWebServerTelemetry();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("./lib/telemetry/server");
  await reportRequestError(error, request, context);
};
