// Validasi zona waktu IANA (ACC-008, ACC-009): nama yang dikenali runtime (`Asia/Jakarta`, `UTC`, …).
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Zona waktu default akun & waktu bisnis (billing, reminder) — ACC-291. */
export const DEFAULT_TIME_ZONE = "Asia/Jakarta";
