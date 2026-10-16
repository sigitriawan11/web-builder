import { APP_PATHS, safeNextPath } from "@platform/shared";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "../../../../components/auth/AuthCard";
import { ConsentForm } from "../../../../components/auth/ConsentForm";
import { apiServerGet } from "../../../../lib/api/server";
import { legalUrls } from "../../../../lib/auth/legal-urls";

interface ConsentResponse {
  data: { terms: { accepted: boolean }; privacy: { accepted: boolean } };
}

// ACC-002 / ACC-313: tujuan callback Google & langkah setelah login. Sudah setuju versi berlaku → langsung ke `next`;
// belum masuk → login.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const next = safeNextPath((await searchParams).next, APP_PATHS.dashboard);
  const consents = await apiServerGet<ConsentResponse>("/v1/account/consents");
  if (consents.status === 401) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (consents.body?.data.terms.accepted && consents.body.data.privacy.accepted) redirect(next);
  const t = await getTranslations("auth.consent");
  return (
    <AuthCard title={t("title")} description={t("description")}>
      <ConsentForm next={next} {...legalUrls()} />
    </AuthCard>
  );
}
