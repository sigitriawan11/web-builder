import { APP_PATHS } from "@platform/shared";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "../../../../components/auth/AuthCard";
import { VerifyEmail, type VerifyMode } from "../../../../components/auth/VerifyEmail";

// ACC-003. Link email → Better Auth → halaman ini: tanpa `?error` = berhasil; `?error=token_expired|invalid_token`
// = kedaluwarsa/tidak valid. Setelah registrasi form mengarahkan ke `?step=code` (form kode 6 digit).
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth.verify");
  const mode: VerifyMode = params.error ? "expired" : params.step === "code" ? "code" : "verified";
  return (
    <AuthCard title={t("title")} description={mode === "verified" ? undefined : t("description")}>
      <VerifyEmail mode={mode} dashboardPath={APP_PATHS.dashboard} />
    </AuthCard>
  );
}
