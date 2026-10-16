"use client";

import { Alert, AlertDescription, Button, Checkbox, Label } from "@platform/ui";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { asFailure, browserApi } from "../../lib/api/browser";
import { useFailureMessage } from "./use-failure-message";

// ACC-002/ACC-313: layar persetujuan S&K + privasi (user Google baru, atau versi legal naik) → `POST /v1/account/consents`.
export function ConsentForm({ next, termsUrl, privacyUrl }: { next: string; termsUrl: string; privacyUrl: string }) {
  const t = useTranslations("auth");
  const failureMessage = useFailureMessage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const legalLink = (href: string) => (chunks: ReactNode) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
      {chunks}
    </a>
  );
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (form.get("acceptTerms") !== "on") {
          setError(t("register.termsRequired"));
          return;
        }
        setPending(true);
        setError(null);
        try {
          await browserApi().account.acceptConsents({
            acceptTerms: true,
            marketingOptIn: form.get("marketingOptIn") === "on",
          });
          window.location.assign(next);
        } catch (failure) {
          setPending(false);
          setError(failureMessage(asFailure(failure)));
        }
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex items-start gap-2">
        <Checkbox id="consent-terms" name="acceptTerms" className="mt-0.5" />
        <Label htmlFor="consent-terms" className="leading-snug font-normal">
          {t.rich("register.acceptTerms", { terms: legalLink(termsUrl), privacy: legalLink(privacyUrl) })}
        </Label>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox id="consent-marketing" name="marketingOptIn" className="mt-0.5" />
        <Label htmlFor="consent-marketing" className="leading-snug font-normal">
          {t("register.marketing")}
        </Label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("common.submitting") : t("consent.submit")}
      </Button>
    </form>
  );
}
