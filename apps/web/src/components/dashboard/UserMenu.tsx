"use client";

import type { Locale } from "@platform/i18n";
import type { Profile } from "@platform/shared/contracts";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  initials,
  type ThemePreference,
  ThemeSwitcher,
} from "@platform/ui";
import { CheckIcon, LogOutIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { apiPost } from "../../lib/auth/client";
import { setLocaleCookie } from "../../lib/preference-cookies";

const LANGUAGES: readonly Locale[] = ["id", "en"];

// Menu user (ACC-050): identitas, tema (ED-012), bahasa (ACC-009: simpan ke profil + cookie, muat ulang halaman yang
// sama), keluar.
export function UserMenu({
  profile,
  theme,
}: {
  profile: Pick<Profile, "name" | "email" | "image">;
  theme: ThemePreference;
}) {
  const t = useTranslations();
  const locale = useLocale();

  async function changeLanguage(next: Locale) {
    if (next === locale) return;
    // Cookie dulu: walau PATCH gagal, bahasa sesi ini tetap berganti; profil dipakai saat login berikutnya & email.
    setLocaleCookie(next);
    await fetch("/api/v1/account/profile", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label={t("dashboard.userMenu.label")}
      >
        <Avatar>
          {profile.image ? <AvatarImage src={profile.image} alt="" /> : null}
          <AvatarFallback>{initials(profile.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{profile.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{profile.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span>{t("dashboard.userMenu.theme")}</span>
          <ThemeSwitcher
            initial={theme}
            groupLabel={t("common.theme.label")}
            labels={{ system: t("common.theme.system"), light: t("common.theme.light"), dark: t("common.theme.dark") }}
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t("dashboard.userMenu.language")}
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {LANGUAGES.map((language) => (
            <DropdownMenuItem key={language} lang={language} onSelect={() => void changeLanguage(language)}>
              {t(`common.language.${language}`)}
              {language === locale ? <CheckIcon className="ml-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await apiPost("/auth/sign-out", {});
            window.location.assign("/login");
          }}
        >
          <LogOutIcon />
          {t("dashboard.userMenu.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
