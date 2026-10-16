"use client";

import { isWeakPasswordReason } from "@platform/shared/contracts";
import { Alert, AlertDescription, Button, Checkbox, Input, Label } from "@platform/ui";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { apiPost, getSession } from "../../lib/auth/client";
import { useFailureMessage } from "./use-failure-message";

// ACC-001: nama, email, password, S&K + privasi (wajib, tidak pre-checked), marketing (opsional, default off),
// timezone browser. Respons identik untuk email baru/terdaftar: hanya user baru yang mendapat sesi → ke halaman
// kode verifikasi; tanpa sesi → pesan generik (tidak membocorkan keberadaan akun).
export function RegisterForm({ termsUrl, privacyUrl }: { termsUrl: string; privacyUrl: string }) {
  const t = useTranslations("auth");
  const failureMessage = useFailureMessage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(form: FormData) {
    if (form.get("acceptTerms") !== "on") {
      setError(t("register.termsRequired"));
      return;
    }
    setPending(true);
    setError(null);
    const result = await apiPost("/auth/sign-up/email", {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      acceptTerms: true,
      marketingOptIn: form.get("marketingOptIn") === "on",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (result.ok) {
      if (await getSession()) {
        window.location.assign("/verify-email?step=code");
        return;
      }
      setPending(false);
      setDone(true);
      return;
    }
    setPending(false);
    if (result.code === "WEAK_PASSWORD") {
      const reason = isWeakPasswordReason(result.details.reason) ? result.details.reason : "generic";
      setError(t(`weakPassword.${reason}`));
    } else {
      setError(failureMessage(result));
    }
  }

  if (done) {
    return (
      <Alert variant="success">
        <AlertDescription>{t("register.checkEmail")}</AlertDescription>
      </Alert>
    );
  }

  const legalLink = (href: string) => (chunks: ReactNode) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
      {chunks}
    </a>
  );

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
        <Label htmlFor="register-name">{t("fields.name")}</Label>
        <Input id="register-name" name="name" autoComplete="name" required maxLength={100} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="register-email">{t("fields.email")}</Label>
        <Input id="register-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="register-password">{t("fields.password")}</Label>
        <Input id="register-password" name="password" type="password" autoComplete="new-password" required />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id="register-terms" name="acceptTerms" className="mt-0.5" />
        <Label htmlFor="register-terms" className="leading-snug font-normal">
          {t.rich("register.acceptTerms", { terms: legalLink(termsUrl), privacy: legalLink(privacyUrl) })}
        </Label>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id="register-marketing" name="marketingOptIn" className="mt-0.5" />
        <Label htmlFor="register-marketing" className="leading-snug font-normal">
          {t("register.marketing")}
        </Label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("common.submitting") : t("register.submit")}
      </Button>
    </form>
  );
}
