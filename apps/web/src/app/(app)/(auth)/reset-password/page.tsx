import { getTranslations } from "next-intl/server";
import { AuthCard } from "../../../../components/auth/AuthCard";
import { InvalidResetLink, ResetPasswordForm } from "../../../../components/auth/ResetPasswordForm";

// ACC-005. Link email → Better Auth → `?token=…` (form password baru) atau `?error=INVALID_TOKEN`.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth.reset");
  return (
    <AuthCard title={t("title")} description={params.token && !params.error ? t("description") : undefined}>
      {params.token && !params.error ? <ResetPasswordForm token={params.token} /> : <InvalidResetLink />}
    </AuthCard>
  );
}
