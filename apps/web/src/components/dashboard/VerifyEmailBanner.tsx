"use client";

import { Button } from "@platform/ui";
import { MailWarningIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiPost } from "../../lib/auth/client";
import { useFailureMessage } from "../auth/use-failure-message";

// ACC-003: banner persisten untuk user belum terverifikasi + kirim ulang (cooldown & batas per jam di api → 429).
export function VerifyEmailBanner({ email }: { email: string }) {
  const t = useTranslations("dashboard.verifyBanner");
  const failureMessage = useFailureMessage();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm"
    >
      <MailWarningIcon className="size-4 text-warning" aria-hidden />
      <span>{notice ?? t("text")}</span>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await apiPost("/auth/send-verification-email", { email });
          setPending(false);
          setNotice(result.ok ? t("sent") : failureMessage(result));
        }}
      >
        {t("resend")}
      </Button>
    </div>
  );
}
