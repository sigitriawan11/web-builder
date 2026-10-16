import { APP_PATHS, safeNextPath } from "@platform/shared";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "../../../../components/auth/AuthCard";
import { ConsentForm } from "../../../../components/auth/ConsentForm";
import { withSession } from "../../../../lib/api/server";
import { legalUrls } from "../../../../lib/auth/legal-urls";

// ACC-002 / ACC-313: tujuan callback Google & langkah setelah login. Sudah setuju versi berlaku → langsung ke `next`;
// belum masuk → login.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const next = safeNextPath((await searchParams).next, APP_PATHS.dashboard);
  const consents = await withSession((api) => api.account.consents(), next);
  if (consents.terms.accepted && consents.privacy.accepted) redirect(next);
  const t = await getTranslations("auth.consent");
  return (
    <AuthCard title={t("title")} description={t("description")}>
      <ConsentForm next={next} {...legalUrls()} />
    </AuthCard>
  );
}
