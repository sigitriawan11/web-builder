"use client";

import type { Profile } from "@platform/shared/contracts";
import { Alert, AlertDescription, Badge, Button, Card, CardContent, CardHeader, Input, Label } from "@platform/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { asFailure, browserApi } from "../../lib/api/browser";
import { apiPost } from "../../lib/auth/client";
import { useFailureMessage } from "../auth/use-failure-message";

type Notice = { kind: "success" | "error"; text: string } | null;

function NoticeAlert({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <Alert variant={notice.kind === "success" ? "success" : "destructive"}>
      <AlertDescription>{notice.text}</AlertDescription>
    </Alert>
  );
}

// ACC-008: nama & email. Ganti email = re-auth (password bila punya; Google-only → sesi baru) lalu verifikasi ke
// alamat BARU (email lama tetap aktif sampai tautan diklik). Avatar menyusul pipeline aset (T2.12.1).
export function ProfileSection({ profile }: { profile: Profile }) {
  const t = useTranslations("dashboard.account.profile");
  const failureMessage = useFailureMessage();
  const [nameNotice, setNameNotice] = useState<Notice>(null);
  const [emailNotice, setEmailNotice] = useState<Notice>(null);
  const [changingEmail, setChangingEmail] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
            try {
              await browserApi().account.updateProfile({ name });
              setNameNotice({ kind: "success", text: t("saved") });
            } catch (error) {
              setNameNotice({ kind: "error", text: failureMessage(asFailure(error)) });
            }
            setPending(false);
          }}
        >
          <Label htmlFor="account-name">{t("name")}</Label>
          <div className="flex gap-2">
            <Input id="account-name" name="name" defaultValue={profile.name} required maxLength={100} />
            <Button type="submit" variant="outline" disabled={pending}>
              {t("save")}
            </Button>
          </div>
          <NoticeAlert notice={nameNotice} />
        </form>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">{t("email")}</span>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span data-testid="account-email">{profile.email}</span>
            {profile.emailVerified ? null : <Badge variant="warning">{t("emailUnverified")}</Badge>}
            {changingEmail ? null : (
              <Button type="button" variant="link" className="px-0" onClick={() => setChangingEmail(true)}>
                {t("changeEmail")}
              </Button>
            )}
          </div>
          {changingEmail ? (
            <form
              className="flex flex-col gap-3 rounded-lg border p-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                setPending(true);
                const result = await apiPost("/auth/change-email", {
                  newEmail: form.get("newEmail"),
                  ...(profile.hasPassword ? { password: form.get("password") } : {}),
                });
                setPending(false);
                if (result.ok) {
                  setEmailNotice({ kind: "success", text: t("changeSent") });
                  setChangingEmail(false);
                } else if (result.code === "REAUTH_REQUIRED") {
                  const fresh = result.details.method === "fresh_login";
                  setEmailNotice({ kind: "error", text: fresh ? t("reauthFresh") : t("reauthPassword") });
                } else setEmailNotice({ kind: "error", text: failureMessage(result) });
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="account-new-email">{t("newEmail")}</Label>
                <Input id="account-new-email" name="newEmail" type="email" autoComplete="email" required />
              </div>
              {profile.hasPassword ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="account-email-password">{t("password")}</Label>
                  <Input
                    id="account-email-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              ) : null}
              <Button type="submit" className="self-start" disabled={pending}>
                {t("sendChange")}
              </Button>
            </form>
          ) : null}
          <NoticeAlert notice={emailNotice} />
        </div>
      </CardContent>
    </Card>
  );
}
