import { getMessages, isLocale, localeFromAcceptLanguage } from "@platform/i18n";
import { isTimeZone } from "@platform/shared";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { TIMEZONE_COOKIE } from "../lib/preference-cookies";
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

async function resolveTimeZone(): Promise<string> {
  const value = (await cookies()).get(TIMEZONE_COOKIE)?.value;
  const decoded = value ? decodeURIComponent(value) : null;
  return decoded && isTimeZone(decoded) ? decoded : "Asia/Jakarta";
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();
  return {
    locale,
    messages: getMessages(locale),
    // ACC-008: tanggal dashboard sesuai zona waktu profil (disalin ke cookie saat login/simpan preferensi);
    // tanpa cookie → zona waktu bisnis platform.
    timeZone: await resolveTimeZone(),
  };
});
