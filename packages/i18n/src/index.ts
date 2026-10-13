import enErrors from "./locales/en/errors.json" with { type: "json" };
import idErrors from "./locales/id/errors.json" with { type: "json" };

// @platform/i18n (ACC-290): string UI/API ID (default) & EN. Fondasi minimal untuk pesan error API (T1.4.4);
// struktur `locales/{id,en}/<namespace>.json`, helper `t()` bertipe, dan deteksi key hilang dilengkapi di T1.15.1.

export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "id";

const MESSAGES = {
  id: { errors: idErrors },
  en: { errors: enErrors },
} as const;

export type Namespace = keyof (typeof MESSAGES)["id"];

/** Teks untuk key; jatuh ke bahasa default, lalu ke key itu sendiri (tidak pernah melempar). */
export function t(locale: Locale, namespace: Namespace, key: string): string {
  const pick = (target: Locale) => (MESSAGES[target][namespace] as Readonly<Record<string, string>>)[key];
  return pick(locale) ?? pick(DEFAULT_LOCALE) ?? key;
}

export function hasMessage(locale: Locale, namespace: Namespace, key: string): boolean {
  return key in MESSAGES[locale][namespace];
}

/** Bahasa dari header `Accept-Language` (q-value dihormati); hanya `id`/`en`, default `id`. */
export function localeFromAcceptLanguage(header: string | undefined | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
      return { language: tag.toLowerCase().split("-")[0] ?? "", q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((entry) => entry.language && Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return (
    (ranked.find((entry) => (LOCALES as readonly string[]).includes(entry.language))?.language as Locale) ??
    DEFAULT_LOCALE
  );
}
