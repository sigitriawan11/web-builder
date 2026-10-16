import { APP_PATHS } from "@platform/shared";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "../../../../components/auth/AuthCard";
import { GoogleButton } from "../../../../components/auth/GoogleButton";
import { RegisterForm } from "../../../../components/auth/RegisterForm";
import { legalUrls } from "../../../../lib/auth/legal-urls";

// ACC-001 (email + password) / ACC-002 (Google: persetujuan S&K di layar `/consent`).
export default async function RegisterPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("register.title")} description={t("register.description")}>
      <GoogleButton next={APP_PATHS.dashboard} />
      <p className="text-center text-xs uppercase text-muted-foreground">{t("common.or")}</p>
      <RegisterForm {...legalUrls()} />
      <p className="text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <a href="/login" className="text-primary underline-offset-4 hover:underline">
          {t("register.login")}
        </a>
      </p>
    </AuthCard>
  );
}
