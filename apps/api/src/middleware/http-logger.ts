import type { IncomingMessage, ServerResponse } from "node:http";
import type { Logger } from "@platform/shared/node";
import type { RequestHandler } from "express";
import { pinoHttp } from "pino-http";

// Middleware 2 (ARCHITECTURE §5.3, §13): satu log JSON per request. Header tidak dicatat (kecuali user-agent)
// sehingga cookie/authorization tidak pernah masuk log; nilai query sensitif disamarkan. requestId & tenant
// datang dari mixin konteks logger.

const SENSITIVE_QUERY = /token|secret|password|signature|key|code/i;

/** Path + query dengan nilai parameter sensitif disamarkan (mis. `?token=…` pada link verifikasi). */
export function safeUrl(url: string): string {
  const [path, query] = url.split("?", 2);
  if (!query) return path ?? url;
  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) if (SENSITIVE_QUERY.test(key)) params.set(key, "[REDACTED]");
  return `${path}?${params.toString()}`;
}

export function httpLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    // requestId sudah di konteks (mixin); hindari id ganda dari pino-http.
    genReqId: (req) => (req as IncomingMessage & { ctx?: { requestId: string } }).ctx?.requestId ?? "",
    // Health check tidak dicatat (dipanggil orchestrator tiap beberapa detik).
    autoLogging: { ignore: (req) => (req.url ?? "").startsWith("/health/") },
    quietReqLogger: true,
    serializers: {
      req: (req: IncomingMessage & { url?: string }) => ({
        method: req.method,
        url: safeUrl(req.url ?? ""),
        userAgent: req.headers["user-agent"],
      }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res, error) =>
      error || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
  }) as unknown as RequestHandler;
}
