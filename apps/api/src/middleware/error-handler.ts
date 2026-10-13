import { localeFromAcceptLanguage, t } from "@platform/i18n";
import { AppError, type ErrorCode, isAppError } from "@platform/shared";
import type { ErrorBody } from "@platform/shared/contracts";
import type { Logger } from "@platform/shared/node";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

// Middleware 12 (ARCHITECTURE §5.3): semua error → envelope `{ error: { code, message, details?, requestId } }`.
// Pesan untuk user dari katalog i18n berdasarkan `Accept-Language`; detail internal (stack, pesan exception)
// tidak pernah dikirim ke klien. Error tak terduga → 500 + `reportError` (Sentry dipasang di T1.16.3).

export type ErrorReporter = (error: unknown, context: { requestId: string; method: string; path: string }) => void;

/** Rute tidak dikenal → 404 NOT_FOUND (envelope yang sama dengan error lain). */
export function notFound(): RequestHandler {
  return (_req, _res, next) => next(new AppError("NOT_FOUND"));
}

// Error bawaan body-parser Express (`type`, `status`) dipetakan ke kode katalog.
function fromBodyParser(error: unknown): AppError | null {
  if (!(error instanceof Error) || !("type" in error)) return null;
  if (error.type === "entity.too.large") return new AppError("PAYLOAD_TOO_LARGE");
  if (error.type === "entity.parse.failed") {
    return new AppError("VALIDATION_FAILED", 422, {
      issues: [{ location: "body", path: "", code: "invalid_json", message: "Body bukan JSON yang valid" }],
    });
  }
  return null;
}

function toAppError(error: unknown): AppError | null {
  if (isAppError(error)) return error;
  if (error instanceof ZodError) {
    return new AppError("VALIDATION_FAILED", 422, {
      issues: error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
  return fromBodyParser(error);
}

export function errorHandler(deps: { logger: Logger; reportError?: ErrorReporter }): ErrorRequestHandler {
  return (error, req, res, next) => {
    // Response sudah mulai terkirim: serahkan ke handler bawaan Express (menutup koneksi).
    if (res.headersSent) return next(error);

    const requestId = req.ctx?.requestId ?? "unknown";
    const known = toAppError(error);
    const code: ErrorCode = known?.code ?? "INTERNAL_ERROR";
    const status = known?.status ?? 500;

    if (!known || status >= 500) {
      deps.logger.error({ err: error }, "unhandled error");
      deps.reportError?.(error, { requestId, method: req.method, path: req.path });
    }
    if (code === "RATE_LIMITED" && typeof known?.details?.retryAfterSeconds === "number") {
      res.setHeader("Retry-After", String(Math.ceil(known.details.retryAfterSeconds)));
    }

    const body: ErrorBody = {
      error: {
        code,
        message: t(localeFromAcceptLanguage(req.get("accept-language")), "errors", code),
        ...(known?.details ? { details: { ...known.details } } : {}),
        requestId,
      },
    };
    res.status(status).json(body);
  };
}
