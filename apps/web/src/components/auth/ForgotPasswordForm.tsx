"use client";

import { Alert, AlertDescription, Button, Input, Label } from "@platform/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiPost } from "../../lib/auth/client";
import { useFailureMessage } from "./use-failure-message";

// ACC-005: respons selalu sama ("jika email terdaftar…") — tidak membocorkan keberadaan akun; 429 ditampilkan.
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const failureMessage = useFailureMessage();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <Alert variant="success">
        <AlertDescription>{t("forgot.sent")}</AlertDescription>
      </Alert>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const result = await apiPost("/auth/request-password-reset", {
          email: new FormData(event.currentTarget).get("email"),
        });
        setPending(false);
        if (result.ok) setSent(true);
        else setError(failureMessage(result));
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="forgot-email">{t("fields.email")}</Label>
        <Input id="forgot-email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("common.submitting") : t("forgot.submit")}
      </Button>
    </form>
  );
}
