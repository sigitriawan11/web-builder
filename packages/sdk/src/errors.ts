import type { ErrorBody } from "@platform/shared/contracts";

// Error dari API (envelope `{ error: { code, message, details, requestId } }`, ARCHITECTURE §5.3) atau dari sisi
// klien. UI bercabang berdasarkan `code` (stabil), bukan teks `message` (sudah dilokalkan server).

// Kode sisi klien (tidak pernah dikirim server).
export const CLIENT_ERROR_CODES = ["NETWORK_ERROR", "TIMEOUT", "INVALID_RESPONSE"] as const;
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];

export class ApiError extends Error {
  readonly code: string;
  // 0 untuk error sisi klien (tanpa response HTTP).
  readonly status: number;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly requestId: string;
  // Dari header `Retry-After` (429) — detik.
  readonly retryAfterSeconds: number | undefined;

  constructor(init: {
    code: string;
    status: number;
    message: string;
    requestId: string;
    details?: Readonly<Record<string, unknown>>;
    retryAfterSeconds?: number;
    cause?: unknown;
  }) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = "ApiError";
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
    this.requestId = init.requestId;
    this.retryAfterSeconds = init.retryAfterSeconds;
  }

  static fromBody(body: ErrorBody, status: number, retryAfterSeconds?: number): ApiError {
    return new ApiError({
      code: body.error.code,
      status,
      message: body.error.message,
      requestId: body.error.requestId,
      ...(body.error.details ? { details: body.error.details } : {}),
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    });
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
