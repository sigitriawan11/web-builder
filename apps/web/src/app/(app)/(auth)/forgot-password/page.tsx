import { getTranslations } from "next-intl/server";
import { AuthCard } from "../../../../components/auth/AuthCard";
import { ForgotPasswordForm } from "../../../../components/auth/ForgotPasswordForm";

// ACC-005: minta tautan reset.
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("forgot.title")} description={t("forgot.description")}>
      <ForgotPasswordForm />
      <a href="/login" className="text-center text-sm text-primary underline-offset-4 hover:underline">
        {t("common.backToLogin")}
      </a>
    </AuthCard>
  );
}
