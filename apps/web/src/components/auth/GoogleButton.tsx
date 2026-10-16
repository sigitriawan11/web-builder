"use client";

import { Button } from "@platform/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiPost } from "../../lib/auth/client";
import { useFailureMessage } from "./use-failure-message";

// ACC-002: OAuth Google lewat Better Auth (`POST /api/auth/sign-in/social` → URL Google). Setelah kembali, user
// diarahkan ke `/consent` yang menampilkan persetujuan S&K bila belum (user Google baru) lalu ke `next`.
export function GoogleButton({ next }: { next: string }) {
  const t = useTranslations("auth.common");
  const failureMessage = useFailureMessage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await apiPost<{ url?: string }>("/auth/sign-in/social", {
            provider: "google",
            callbackURL: `/consent?next=${encodeURIComponent(next)}`,
          });
          if (result.ok && result.data.url) {
            window.location.assign(result.data.url);
            return;
          }
          setPending(false);
          setError(result.ok ? t("unexpected") : failureMessage(result));
        }}
      >
        {t("google")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
