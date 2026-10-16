import {
  isLocale,
  type Locale,
  localeFromAcceptLanguage,
  type MessageKey,
  type MessageValues,
  t,
} from "@platform/i18n";
import { createContext, type ReactNode, useContext } from "react";

// Konteks bahasa ringan editor (ARCHITECTURE §5.2, ACC-290): pesan namespace `editor` @platform/i18n. Bahasa awal dari
// cookie `NEXT_LOCALE` (sama origin dengan dashboard, disinkronkan dari profil saat login/ganti bahasa) → bahasa
// browser → `id`. UI editor lengkap dwibahasa = T1.15.6.
const LOCALE_COOKIE = "NEXT_LOCALE";

export function initialLocale(
  cookie: string = document.cookie,
  languages: readonly string[] = navigator.languages,
): Locale {
  const fromCookie = cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  if (isLocale(fromCookie)) return fromCookie;
  return localeFromAcceptLanguage(languages.join(","));
}

const LocaleContext = createContext<Locale>("id");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** `t` untuk namespace `editor` dalam bahasa aktif. */
export function useT(): (key: MessageKey<"editor">, values?: MessageValues) => string {
  const locale = useLocale();
  return (key, values) => t(locale, "editor", key, values);
}
