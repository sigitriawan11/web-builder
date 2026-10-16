import { APP_PATHS, safeNextPath } from "@platform/shared";
import { Alert, AlertDescription } from "@platform/ui";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "../../../../components/auth/AuthCard";
import { GoogleButton } from "../../../../components/auth/GoogleButton";
import { LoginForm } from "../../../../components/auth/LoginForm";
import { loadWebEnv } from "../../../../config/routing";

// ACC-004 / ACC-002. `?next=` hanya path internal (safeNextPath, cegah open redirect); `?error=account_not_linked`
// dari callback Google yang ditolak penautannya.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth");
  const next = safeNextPath(params.next, APP_PATHS.dashboard);
  return (
    <AuthCard title={t("login.title")} description={t("login.description")}>
      {params.error === "account_not_linked" ? (
        <Alert variant="destructive">
          <AlertDescription>{t("login.accountNotLinked")}</AlertDescription>
        </Alert>
      ) : null}
      <GoogleButton next={next} />
      <p className="text-center text-xs uppercase text-muted-foreground">{t("common.or")}</p>
      <LoginForm next={next} siteKey={loadWebEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <a href="/register" className="text-primary underline-offset-4 hover:underline">
          {t("login.register")}
        </a>
      </p>
    </AuthCard>
  );
}
