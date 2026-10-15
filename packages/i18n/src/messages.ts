import enAdmin from "../messages/en/admin.json" with { type: "json" };
import enAuth from "../messages/en/auth.json" with { type: "json" };
import enBilling from "../messages/en/billing.json" with { type: "json" };
import enCommon from "../messages/en/common.json" with { type: "json" };
import enDashboard from "../messages/en/dashboard.json" with { type: "json" };
import enEditor from "../messages/en/editor.json" with { type: "json" };
import enEmails from "../messages/en/emails.json" with { type: "json" };
import enErrors from "../messages/en/errors.json" with { type: "json" };
import idAdmin from "../messages/id/admin.json" with { type: "json" };
import idAuth from "../messages/id/auth.json" with { type: "json" };
import idBilling from "../messages/id/billing.json" with { type: "json" };
import idCommon from "../messages/id/common.json" with { type: "json" };
import idDashboard from "../messages/id/dashboard.json" with { type: "json" };
import idEditor from "../messages/id/editor.json" with { type: "json" };
import idEmails from "../messages/id/emails.json" with { type: "json" };
import idErrors from "../messages/id/errors.json" with { type: "json" };

// Katalog pesan (ACC-290): `messages/{id,en}/<namespace>.json`, objek bersarang, nilai = ICU MessageFormat.
// Bahasa `id` adalah sumber tipe key; kelengkapan `en` dijaga `checkMessages()` (test + `pnpm i18n:check`).

export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "id";

const ID = {
  common: idCommon,
  auth: idAuth,
  dashboard: idDashboard,
  editor: idEditor,
  billing: idBilling,
  admin: idAdmin,
  emails: idEmails,
  errors: idErrors,
};
type Catalog = typeof ID;

export const MESSAGES: Readonly<Record<Locale, Catalog>> = {
  id: ID,
  // Struktur `en` mengikuti `id` (dicek `checkMessages`); cast hanya agar JSON berbeda isi tetap satu tipe.
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    editor: enEditor,
    billing: enBilling,
    admin: enAdmin,
    emails: enEmails,
    errors: enErrors,
  } as unknown as Catalog,
};

export type Namespace = keyof Catalog;
export const NAMESPACES = Object.keys(ID) as Namespace[];

// Path bertitik ke setiap pesan (daun string), mis. `auth.welcome.subject`.
type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? Leaves<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type MessageKey<N extends Namespace> = Leaves<Catalog[N]>;
/** Bentuk pesan satu bahasa untuk next-intl (`{ namespace: {...} }`). */
export type Messages = Catalog;
