import type { Locale } from "@platform/i18n";
import { LOCALE_COOKIE } from "./proxy/decide";

/** Simpan bahasa UI di cookie `NEXT_LOCALE` (spec 08 §13) — dibaca proxy pada request berikutnya. */
export function setLocaleCookie(locale: Locale): void {
  // biome-ignore lint/suspicious/noDocumentCookie: cookie preferensi sederhana non-rahasia; Cookie Store API belum merata.
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
