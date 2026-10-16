"use client";

import type { SessionInfo } from "@platform/shared/contracts";
import { Alert, AlertDescription, Badge, Button, Card, CardContent, CardHeader } from "@platform/ui";
import { MonitorSmartphoneIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { asFailure, browserApi } from "../../lib/api/browser";
import { formatIp } from "../../lib/ip";
import { summarizeUserAgent } from "../../lib/user-agent";
import { useFailureMessage } from "../auth/use-failure-message";

// ACC-007: daftar sesi (Postgres) — "Perangkat ini" tidak bisa dicabut dari daftar (pakai Keluar di menu user);
// sesi lain dicabut satu per satu atau sekaligus (api mencabut DB + cache → 401 seketika).
export function SessionsSection({ initial }: { initial: SessionInfo[] }) {
  const t = useTranslations("dashboard.account.sessions");
  const format = useFormatter();
  const failureMessage = useFailureMessage();
  const [sessions, setSessions] = useState(initial);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function reload() {
    try {
      setSessions(await browserApi().account.sessions());
    } catch (error) {
      setNotice({ kind: "error", text: failureMessage(asFailure(error)) });
    }
  }

  const others = sessions.filter((session) => !session.current);
  const location = (session: SessionInfo) =>
    [session.geo?.city, session.geo?.country].filter((part): part is string => Boolean(part)).join(", ");

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y rounded-lg border">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center gap-3 p-3" data-testid="session-row">
              <MonitorSmartphoneIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{summarizeUserAgent(session.userAgent) ?? t("unknownDevice")}</span>
                  {session.current ? <Badge variant="secondary">{t("current")}</Badge> : null}
                </div>
                <span className="text-muted-foreground">
                  {[formatIp(session.ip), location(session)].filter(Boolean).join(" · ")}
                </span>
                <span className="text-muted-foreground">
                  {session.lastActiveAt
                    ? t("lastActive", {
                        time: format.dateTime(new Date(session.lastActiveAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                      })
                    : t("signedIn", {
                        time: format.dateTime(new Date(session.createdAt), { dateStyle: "medium", timeStyle: "short" }),
                      })}
                </span>
              </div>
              {session.current ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await browserApi().account.revokeSession(session.id);
                    } catch (error) {
                      setNotice({ kind: "error", text: failureMessage(asFailure(error)) });
                    }
                    setPending(false);
                    await reload();
                  }}
                >
                  {t("revoke")}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {others.length > 0 ? (
          <Button
            variant="outline"
            className="self-start"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const { revoked } = await browserApi().account.revokeOtherSessions();
                setNotice({ kind: "success", text: t("revokedOthers", { count: revoked }) });
              } catch (error) {
                setNotice({ kind: "error", text: failureMessage(asFailure(error)) });
              }
              setPending(false);
              await reload();
            }}
          >
            {t("revokeOthers")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {notice ? (
          <Alert variant={notice.kind === "success" ? "success" : "destructive"}>
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
