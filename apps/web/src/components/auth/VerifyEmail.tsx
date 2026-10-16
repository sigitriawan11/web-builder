"use client";

import { Alert, AlertDescription, Button, Input, Label } from "@platform/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { apiPost, getSession, type SessionUser } from "../../lib/auth/client";
import { useFailureMessage } from "./use-failure-message";

export type VerifyMode = "code" | "expired" | "verified";

// ACC-003 — tiga keadaan halaman `/verify-email`:
// - `code`: setelah registrasi (sesi ada): form kode 6 digit + kirim ulang + "Nanti saja";
// - `expired`: link kedaluwarsa/tidak valid (`?error=`): kirim ulang;
// - `verified`: link berhasil (Better Auth mengarahkan ke sini tanpa error).
export function VerifyEmail({ mode, dashboardPath }: { mode: VerifyMode; dashboardPath: string }) {
  const t = useTranslations("auth");
  const failureMessage = useFailureMessage();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [state, setState] = useState<VerifyMode>(mode);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void getSession().then((session) => {
      setUser(session?.user ?? null);
      if (session?.user.emailVerified) setState("verified");
    });
  }, []);

  async function resend(email: string) {
    setPending(true);
    const result = await apiPost("/auth/send-verification-email", { email });
    setPending(false);
    setNotice(
      result.ok ? { kind: "success", text: t("verify.resent") } : { kind: "error", text: failureMessage(result) },
    );
  }

  async function verifyCode(form: FormData) {
    if (!user) return;
    setPending(true);
    setNotice(null);
    const result = await apiPost("/auth/email-otp/verify-email", {
      email: user.email,
      otp: String(form.get("code")).trim(),
    });
    setPending(false);
    if (result.ok) {
      setState("verified");
      return;
    }
    setNotice({ kind: "error", text: result.status === 429 ? failureMessage(result) : t("verify.invalidCode") });
  }

  const noticeAlert = notice ? (
    <Alert variant={notice.kind === "success" ? "success" : "destructive"}>
      <AlertDescription>{notice.text}</AlertDescription>
    </Alert>
  ) : null;

  if (state === "verified") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">
          <AlertDescription>{t("verify.success")}</AlertDescription>
        </Alert>
        <Button asChild>
          <a href={user ? dashboardPath : "/login"}>{user ? t("verify.continue") : t("common.backToLogin")}</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {state === "expired" ? (
        <Alert variant="destructive">
          <AlertDescription>{t("verify.expired")}</AlertDescription>
        </Alert>
      ) : null}
      {noticeAlert}
      {user ? (
        <>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode(new FormData(event.currentTarget));
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="verify-code">{t("fields.code")}</Label>
              <Input
                id="verify-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </div>
            <Button type="submit" disabled={pending}>
              {t("verify.submit")}
            </Button>
          </form>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="link"
              className="px-0"
              disabled={pending}
              onClick={() => void resend(user.email)}
            >
              {t("verify.resend")}
            </Button>
            <a href={dashboardPath} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              {t("verify.later")}
            </a>
          </div>
        </>
      ) : (
        <Button asChild variant="outline">
          <a href="/login">{t("common.backToLogin")}</a>
        </Button>
      )}
    </div>
  );
}
