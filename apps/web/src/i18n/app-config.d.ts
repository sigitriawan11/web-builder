import type { Locale, Messages } from "@platform/i18n";

// Tipe next-intl: key `useTranslations`/`getTranslations` dicek terhadap katalog @platform/i18n.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
