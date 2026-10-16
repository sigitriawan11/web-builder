import type { Locale } from "@platform/i18n";
import { LOCALE_COOKIE } from "./proxy/decide";

// Preferensi tampilan dari profil akun (ACC-009) disalin ke cookie agar dibaca setiap request tanpa memanggil api:
// bahasa (`NEXT_LOCALE`, spec 08 §13, dibaca proxy) & zona waktu (`NEXT_TIMEZONE`, dibaca konfigurasi next-intl).
export const TIMEZONE_COOKIE = "NEXT_TIMEZONE";
const ONE_YEAR = 31_536_000;

function setCookie(name: string, value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: cookie preferensi sederhana non-rahasia; Cookie Store API belum merata.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

export function setLocaleCookie(locale: Locale): void {
  setCookie(LOCALE_COOKIE, locale);
}

export function setTimeZoneCookie(timeZone: string): void {
  setCookie(TIMEZONE_COOKIE, timeZone);
}
