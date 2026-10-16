import type { SessionInfo } from "@platform/shared/contracts";
import { getTranslations } from "next-intl/server";
import { PreferencesSection } from "../../../../components/account/PreferencesSection";
import { ProfileSection } from "../../../../components/account/ProfileSection";
import { SessionsSection } from "../../../../components/account/SessionsSection";
import { apiServerGet } from "../../../../lib/api/server";
import { getDashboardSession } from "../../../../lib/workspace/current";

// Halaman akun (ACC-007, ACC-008, ACC-009): profil, bahasa & zona waktu, sesi aktif.
export default async function AccountPage() {
  const { profile } = await getDashboardSession();
  const sessions = await apiServerGet<{ data: SessionInfo[] }>("/v1/account/sessions");
  const t = await getTranslations("dashboard.account");
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <ProfileSection profile={profile} />
      <PreferencesSection locale={profile.locale} timeZone={profile.timezone} />
      <SessionsSection initial={sessions.body?.data ?? []} />
    </div>
  );
}
