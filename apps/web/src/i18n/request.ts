import { getMessages, isLocale, localeFromAcceptLanguage } from "@platform/i18n";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, LOCALE_HEADER } from "../lib/proxy/decide";

// next-intl tanpa routing bahasa di URL (ARCHITECTURE §5.1, ACC-290): bahasa dihitung proxy (cookie `NEXT_LOCALE` →
// Accept-Language → `id`) dan diteruskan lewat header `x-locale`; fallback menghitung ulang bila header tidak ada
// (mis. request yang tidak melewati proxy). Preferensi akun (`users.locale`) disinkronkan ke cookie saat login /
// ganti bahasa (T1.14.4, T1.14.8).
export async function resolveRequestLocale() {
  const requestHeaders = await headers();
  const fromProxy = requestHeaders.get(LOCALE_HEADER);
  if (isLocale(fromProxy)) return fromProxy;
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return localeFromAcceptLanguage(requestHeaders.get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();
  return {
    locale,
    messages: getMessages(locale),
    // Zona waktu default platform (ACC-291); per user dari profil menyusul (T1.15.2/T1.14.8).
    timeZone: "Asia/Jakarta",
  };
});
