import { type ErrorCode, statusForCode } from "./codes";

export type ErrorDetails = Readonly<Record<string, unknown>>;

/**
 * Error yang diharapkan (ARCHITECTURE §18): dilempar service, dipetakan error handler API ke
 * `{ error: { code, message, details, requestId } }` dengan status `status`. `message` di sini untuk log
 * developer; pesan untuk user dilokalkan dari `code` (Accept-Language) di boundary API.
 */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    status?: number,
    readonly details?: ErrorDetails,
    options?: { message?: string; cause?: unknown },
  ) {
    super(options?.message ?? code, options?.cause === undefined ? undefined : { cause: options.cause });
    const resolved = status ?? statusForCode(code);
    if (!Number.isInteger(resolved) || resolved < 400 || resolved > 599) {
      throw new RangeError(`AppError ${code}: status ${resolved} bukan status error HTTP (400–599)`);
    }
    this.name = "AppError";
    this.status = resolved;
  }
}

/** `instanceof` bisa gagal bila paket ter-bundle dua kali; nama kelas jadi cadangan. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError || (error instanceof Error && error.name === "AppError" && "code" in error);
}
