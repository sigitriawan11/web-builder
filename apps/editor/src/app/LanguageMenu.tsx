import { LOCALES, type Locale, t as translate } from "@platform/i18n";
import { useProfile, useUpdateProfile } from "@platform/sdk/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@platform/ui";
import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { ToolbarButton } from "./chrome/ToolbarButton";
import { useLocale, useSetLocale, useT } from "./i18n";

// ED-221: bahasa UI editor bisa diganti cepat dari menu tanpa reload; pilihan disimpan ke profil (ACC-009) sehingga
// dashboard, email, dan sesi berikutnya ikut.
export function LanguageMenu() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const updateProfile = useUpdateProfile();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton label={t("app.language")} icon={<LanguagesIcon />} data-testid="toolbar-language" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("app.language")}</DropdownMenuLabel>
        {LOCALES.map((language) => (
          <DropdownMenuItem
            key={language}
            lang={language}
            onSelect={() => {
              if (language === locale) return;
              setLocale(language);
              updateProfile.mutate({ locale: language });
            }}
          >
            {/* Nama bahasa dalam bahasanya sendiri (katalog `common.language`). */}
            {translate(language, "common", `language.${language}`)}
            {language === locale ? <CheckIcon className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Bahasa profil (sumber kebenaran ACC-009) menang atas cookie lama saat editor dibuka — sekali per sesi editor. */
export function ProfileLocaleSync() {
  const profile = useProfile();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const synced = useRef(false);
  const profileLocale: Locale | undefined = profile.data?.locale;
  useEffect(() => {
    if (synced.current || !profileLocale) return;
    synced.current = true;
    if (profileLocale !== locale) setLocale(profileLocale);
  }, [profileLocale, locale, setLocale]);
  return null;
}
