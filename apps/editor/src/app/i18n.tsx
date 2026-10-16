import {
  isLocale,
  type Locale,
  localeFromAcceptLanguage,
  type MessageKey,
  type MessageValues,
  t,
} from "@platform/i18n";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

// Bahasa UI editor (ED-221, ACC-290): pesan namespace `editor` @platform/i18n. Bahasa awal dari cookie `NEXT_LOCALE`
// (sama origin dengan dashboard, disalin dari profil saat login/ganti bahasa) → bahasa browser → `id`. Ganti bahasa
// = ganti state React (tanpa reload, dokumen tidak tersentuh) + cookie + `<html lang>`; profil disimpan pemanggil.
export const LOCALE_COOKIE = "NEXT_LOCALE";

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

interface LocaleState {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleState>({ locale: "id", setLocale: () => {} });

export function I18nProvider({
  initial,
  onChange,
  children,
}: {
  initial: Locale;
  // Dipanggil setiap bahasa berganti (mis. memperbarui bahasa klien api).
  onChange?: (locale: Locale) => void;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(initial);
  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.documentElement.lang = next;
      // biome-ignore lint/suspicious/noDocumentCookie: cookie preferensi non-rahasia yang juga dibaca dashboard.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      onChange?.(next);
    },
    [onChange],
  );
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useSetLocale(): (next: Locale) => void {
  return useContext(LocaleContext).setLocale;
}

/** `t` untuk namespace `editor` dalam bahasa aktif. */
export function useT(): (key: MessageKey<"editor">, values?: MessageValues) => string {
  const locale = useLocale();
  return useCallback((key, values) => t(locale, "editor", key, values), [locale]);
}
