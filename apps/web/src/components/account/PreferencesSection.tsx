"use client";

import type { Locale } from "@platform/i18n";
import { Alert, AlertDescription, Button, Card, CardContent, CardHeader, Label, NativeSelect } from "@platform/ui";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { asFailure, browserApi } from "../../lib/api/browser";
import { setLocaleCookie, setTimeZoneCookie } from "../../lib/preference-cookies";
import { useFailureMessage } from "../auth/use-failure-message";

const LANGUAGES: readonly Locale[] = ["id", "en"];

// ACC-009 / ACC-008: bahasa (tampilan & email) + zona waktu (semua tanggal dashboard). Disimpan di profil lalu disalin
// ke cookie, halaman yang sama dimuat ulang dalam bahasa/zona waktu baru.
export function PreferencesSection({ locale, timeZone }: { locale: Locale; timeZone: string }) {
  const t = useTranslations();
  const failureMessage = useFailureMessage();
  const [zone, setZone] = useState(timeZone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deviceZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf("timeZone");
    return all.includes(timeZone) ? all : [timeZone, ...all];
  }, [timeZone]);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{t("dashboard.account.preferences.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("dashboard.account.preferences.hint")}</p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const nextLocale = String(form.get("locale")) as Locale;
            setPending(true);
            setError(null);
            try {
              await browserApi().account.updateProfile({ locale: nextLocale, timezone: zone });
            } catch (failure) {
              setPending(false);
              setError(failureMessage(asFailure(failure)));
              return;
            }
            setLocaleCookie(nextLocale);
            setTimeZoneCookie(zone);
            window.location.reload();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-locale">{t("dashboard.account.preferences.language")}</Label>
            <NativeSelect id="account-locale" name="locale" defaultValue={locale}>
              {LANGUAGES.map((language) => (
                <option key={language} value={language} lang={language}>
                  {t(`common.language.${language}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-timezone">{t("dashboard.account.preferences.timezone")}</Label>
            <NativeSelect id="account-timezone" value={zone} onChange={(event) => setZone(event.target.value)}>
              {zones.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </NativeSelect>
            {deviceZone && deviceZone !== zone ? (
              <Button type="button" variant="link" className="self-start px-0" onClick={() => setZone(deviceZone)}>
                {t("dashboard.account.preferences.useDevice", { timezone: deviceZone })}
              </Button>
            ) : null}
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="self-start" disabled={pending}>
            {t("dashboard.account.preferences.save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
