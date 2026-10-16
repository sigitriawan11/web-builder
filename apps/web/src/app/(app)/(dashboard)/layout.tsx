import { isThemePreference, THEME_COOKIE } from "@platform/ui";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SidebarNav } from "../../../components/dashboard/SidebarNav";
import { UserMenu } from "../../../components/dashboard/UserMenu";
import { VerifyEmailBanner } from "../../../components/dashboard/VerifyEmailBanner";
import { WorkspaceSwitcher } from "../../../components/dashboard/WorkspaceSwitcher";
import { getDashboardSession } from "../../../lib/workspace/current";

// Layout dashboard (ACC-050, ARCHITECTURE §5.1): data dari api (cookie diteruskan) — profil & daftar workspace.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile: user, workspaces, current } = await getDashboardSession();
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col gap-4 border-r bg-card p-4 md:flex">
        <a href="/sites" className="px-1 text-lg font-semibold">
          {t("brand")}
        </a>
        <WorkspaceSwitcher workspaces={workspaces} current={current} />
        <SidebarNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {user.emailVerified ? null : <VerifyEmailBanner email={user.email} />}
        <header className="flex h-14 items-center justify-end gap-3 border-b px-4">
          <UserMenu profile={user} theme={isThemePreference(theme) ? theme : "system"} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
