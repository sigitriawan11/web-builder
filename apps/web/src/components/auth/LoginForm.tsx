"use client";

import type { Locale } from "@platform/i18n";
import { Alert, AlertDescription, Button, Checkbox, Input, Label } from "@platform/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiGet, apiPost } from "../../lib/auth/client";
import { setLocaleCookie, setTimeZoneCookie } from "../../lib/preference-cookies";
import { Turnstile } from "./Turnstile";
import { useFailureMessage } from "./use-failure-message";

interface ConsentStatus {
  data: { terms: { accepted: boolean }; privacy: { accepted: boolean } };
}

/**
 * Setelah masuk: bila S&K/privasi versi berlaku belum disetujui (ACC-313), lewati layar persetujuan dulu.
 * Navigasi penuh (bukan router klien) agar komponen server membaca cookie sesi baru.
 */
export async function continueAfterSignIn(next: string): Promise<void> {
  // Bahasa akun (users.locale) menjadi bahasa UI sejak login (ACC-009).
  const profile = await apiGet<{ data: { locale: Locale; timezone: string } }>("/v1/account/profile");
  if (profile.ok) {
    setLocaleCookie(profile.data.data.locale);
    setTimeZoneCookie(profile.data.data.timezone);
  }
  const consents = await apiGet<ConsentStatus>("/v1/account/consents");
  const needsConsent = consents.ok && !(consents.data.data.terms.accepted && consents.data.data.privacy.accepted);
  window.location.assign(needsConsent ? `/consent?next=${encodeURIComponent(next)}` : next);
}

// ACC-004: email + password, "Ingat saya" (30 hari; tanpa centang 1 hari), pesan error generik, Turnstile setelah 3
// gagal (403 CAPTCHA_REQUIRED → kirim ulang dengan header `x-captcha-response`), 429 = terkunci 15 menit.
export function LoginForm({ next, siteKey }: { next: string; siteKey: string }) {
  const t = useTranslations("auth");
  const failureMessage = useFailureMessage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaNeeded, setCaptchaNeeded] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const result = await apiPost(
      "/auth/sign-in/email",
      { email: form.get("email"), password: form.get("password"), rememberMe: form.get("rememberMe") === "on" },
      captchaToken ? { "x-captcha-response": captchaToken } : undefined,
    );
    if (result.ok) {
      await continueAfterSignIn(next);
      return;
    }
    setPending(false);
    // Token Turnstile sekali pakai.
    setCaptchaToken(null);
    if (result.code === "CAPTCHA_REQUIRED") {
      setCaptchaNeeded(true);
      setError(t("login.captchaRequired"));
    } else if (result.status === 429) {
      setError(t("login.locked", { minutes: Math.max(1, Math.ceil((result.retryAfterSeconds ?? 900) / 60)) }));
    } else if (result.status === 401 || result.code === "INVALID_EMAIL_OR_PASSWORD") {
      setError(t("login.invalid"));
    } else {
      setError(failureMessage(result));
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email">{t("fields.email")}</Label>
        <Input id="login-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">{t("fields.password")}</Label>
          <a href="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
            {t("login.forgot")}
          </a>
        </div>
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="login-remember" name="rememberMe" defaultChecked />
        <Label htmlFor="login-remember">{t("login.rememberMe")}</Label>
      </div>
      {captchaNeeded ? <Turnstile siteKey={siteKey} onToken={setCaptchaToken} /> : null}
      <Button type="submit" disabled={pending || (captchaNeeded && !captchaToken)}>
        {pending ? t("common.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
