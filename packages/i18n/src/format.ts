import type { Locale } from "./messages";

// Format angka, mata uang, ukuran, tanggal (ACC-291) berbasis `Intl` — satu sumber untuk api, worker, editor & web.
// Waktu disimpan UTC; ditampilkan di zona waktu user (default zona waktu bisnis platform `Asia/Jakarta`).

export const DEFAULT_TIME_ZONE = "Asia/Jakarta";
const INTL_LOCALE: Readonly<Record<Locale, string>> = { id: "id-ID", en: "en" };

/** IDR tanpa desimal (uang disimpan integer IDR): `id` → "Rp 49.000", `en` → "IDR 49,000". */
export function formatCurrency(amount: number | bigint, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "IDR",
    // `en` memakai kode agar tidak tertukar dengan simbol mata uang lain.
    currencyDisplay: locale === "id" ? "symbol" : "code",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number | bigint, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Ukuran berbasis 1024 dengan maksimal 1 desimal: `3_221_225_472` → "3 GB", `1_572_864` → "1,5 MB" (id). */
export function formatBytes(bytes: number, locale: Locale): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${formatNumber(value, locale, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${BYTE_UNITS[unit]}`;
}

/** Tanggal pendek di zona waktu user: `id` → "12 Okt 2026". */
export function formatDate(date: Date, locale: Locale, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

// Dipakai beberapa versi ICU sebelum AM/PM; versi lain memakai spasi biasa.
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);

/** Seragamkan spasi keluaran Intl agar teks server & browser identik (mencegah hydration mismatch). */
export function normalizeIntlSpaces(text: string): string {
  return text.replaceAll(NARROW_NO_BREAK_SPACE, " ");
}

/** Tanggal + jam + nama zona: `id` → "12 Okt 2026, 14.30 WIB". */
export function formatDateTime(date: Date, locale: Locale, timeZone: string = DEFAULT_TIME_ZONE): string {
  return (
    new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone,
    })
      .format(date)
      // Versi ICU berbeda memakai spasi biasa atau U+202F sebelum AM/PM → diseragamkan agar server & browser sama
      // (mencegah hydration mismatch).
      .replaceAll("\u202f", " ")
  );
}

const RELATIVE_STEPS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.345],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** Waktu relatif terhadap `now`: `id` → "3 menit yang lalu", "sekarang", "dalam 2 hari". */
export function formatRelative(date: Date, locale: Locale, now: Date = new Date()): string {
  let value = (date.getTime() - now.getTime()) / 1000;
  const format = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(value) < size) return format.format(Math.round(value), unit);
    value /= size;
  }
  return format.format(Math.round(value), "year");
}
