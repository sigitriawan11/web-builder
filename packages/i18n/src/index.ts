import { IntlMessageFormat } from "intl-messageformat";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  MESSAGES,
  type MessageKey,
  type Messages,
  type Namespace,
} from "./messages";

// @platform/i18n (ACC-290): string UI/API/email ID (default) & EN dalam ICU MessageFormat. Dipakai api (pesan error),
// worker (email), web (next-intl memakai `getMessages`), editor (konteks ringan, T1.15.6).

export { checkMessages, formatIssues, type MessageIssue } from "./check";
export {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type MessageKey,
  type Messages,
  NAMESPACES,
  type Namespace,
} from "./messages";

export type MessageValues = Readonly<Record<string, string | number | Date>>;

function lookup(locale: Locale, namespace: Namespace, key: string): string | undefined {
  let node: unknown = MESSAGES[locale][namespace];
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

const formatters = new Map<string, IntlMessageFormat>();

function format(locale: Locale, message: string, values?: MessageValues): string {
  const cacheKey = `${locale}\u0000${message}`;
  let formatter = formatters.get(cacheKey);
  if (!formatter) {
    formatter = new IntlMessageFormat(message, locale, undefined, { ignoreTag: true });
    formatters.set(cacheKey, formatter);
  }
  try {
    return String(formatter.format(values));
  } catch {
    // Nilai placeholder tidak diberikan → teks mentah (tidak pernah melempar ke pemanggil).
    return message;
  }
}

/** Pesan untuk key bertipe; jatuh ke bahasa default, lalu ke key itu sendiri. Nilai = ICU (`{name}`, plural, select). */
export function t<N extends Namespace>(
  locale: Locale,
  namespace: N,
  key: MessageKey<N>,
  values?: MessageValues,
): string {
  return translate(locale, namespace, key, values);
}

/**
 * Seperti `t()` untuk key yang baru diketahui saat runtime (kode error dari server, nama template job). Key yang
 * tidak ada → key itu sendiri; cek dulu dengan `hasMessage` bila perlu.
 */
export function translate(locale: Locale, namespace: Namespace, key: string, values?: MessageValues): string {
  const message = lookup(locale, namespace, key) ?? lookup(DEFAULT_LOCALE, namespace, key);
  return message === undefined ? key : format(locale, message, values);
}

export function hasMessage(locale: Locale, namespace: Namespace, key: string): boolean {
  return lookup(locale, namespace, key) !== undefined;
}

/** Semua namespace satu bahasa — bentuk yang diterima next-intl (`NextIntlClientProvider messages`). */
export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
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
  return (ranked.find((entry) => isLocale(entry.language))?.language as Locale | undefined) ?? DEFAULT_LOCALE;
}
