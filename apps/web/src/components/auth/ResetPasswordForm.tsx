"use client";

import { isWeakPasswordReason } from "@platform/shared/contracts";
import { Alert, AlertDescription, Button, Input, Label } from "@platform/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiPost } from "../../lib/auth/client";
import { useFailureMessage } from "./use-failure-message";

// ACC-005: token dari link email (`?token=`); kebijakan password = registrasi (WEAK_PASSWORD); token kedaluwarsa /
// terpakai → INVALID_TOKEN dengan tautan minta ulang.
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const failureMessage = useFailureMessage();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<"form" | "done" | "invalid">("form");
  const [error, setError] = useState<string | null>(null);

  if (state === "done") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">
          <AlertDescription>{t("reset.success")}</AlertDescription>
        </Alert>
        <Button asChild>
          <a href="/login">{t("login.submit")}</a>
        </Button>
      </div>
    );
  }
  if (state === "invalid") return <InvalidResetLink />;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const newPassword = new FormData(event.currentTarget).get("newPassword");
        const result = await apiPost("/auth/reset-password", { token, newPassword });
        setPending(false);
        if (result.ok) setState("done");
        else if (result.code === "WEAK_PASSWORD") {
          const reason = isWeakPasswordReason(result.details.reason) ? result.details.reason : "generic";
          setError(t(`weakPassword.${reason}`));
        } else if (result.code === "INVALID_TOKEN") setState("invalid");
        else setError(failureMessage(result));
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="reset-password">{t("fields.newPassword")}</Label>
        <Input id="reset-password" name="newPassword" type="password" autoComplete="new-password" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("common.submitting") : t("reset.submit")}
      </Button>
    </form>
  );
}

export function InvalidResetLink() {
  const t = useTranslations("auth.reset");
  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <AlertDescription>{t("invalid")}</AlertDescription>
      </Alert>
      <Button asChild variant="outline">
        <a href="/forgot-password">{t("requestNew")}</a>
      </Button>
    </div>
  );
}
