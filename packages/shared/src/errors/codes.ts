import { z } from "zod";

// Katalog kode error API (ARCHITECTURE §5.3): kode UPPER_SNAKE stabil → status HTTP default.
// Klien (web, editor, island) bercabang berdasarkan `code`, bukan teks pesan. Kode domain (mis. `SUBDOMAIN_TAKEN`,
// `DOMAIN_VERIFICATION_FAILED`) ditambahkan di sini saat fiturnya dibangun; kode yang sudah dipakai klien tidak boleh diganti nama.
export const ERROR_STATUS = {
  VALIDATION_FAILED: 422, // `details.issues` = Zod issues
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403, // role kurang di tenant sendiri
  NOT_FOUND: 404, // juga resource tenant lain — jangan bocorkan keberadaannya
  CONFLICT: 409,
  PLAN_LIMIT_REACHED: 402, // details: { key, used, limit, upgrade? } — site, seat, storage, kuota bulanan
  // Batas paket: satu kode per konsep, jenisnya di details (diseragamkan 2026-10-13, lihat ARCHITECTURE §5.3).
  PLAN_FEATURE_REQUIRED: 402, // details: { feature, upgrade? }
  INSUFFICIENT_CREDITS: 402,
  RATE_LIMITED: 429, // + header Retry-After
  INTERNAL_ERROR: 500, // error tak terduga; detail hanya di log/Sentry
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const ErrorCodeSchema = z.enum(Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]]);

export function statusForCode(code: ErrorCode): number {
  return ERROR_STATUS[code];
}
