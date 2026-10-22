import { isApiError } from "@platform/sdk";
import type { LibraryStatus } from "@platform/shared/contracts";
import { Badge } from "@platform/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AdminComponentActions } from "../../../../../../components/admin/AdminComponentActions";
import { withSession } from "../../../../../../lib/api/server";

// T3.8.2 (ACC-208/CMP-045/CMP-051): detail component admin — riwayat versi + changelog, pemakaian, aksi deprecate/
// archive (hanya kapabilitas publish). Role-gate di layout `(admin)`; defensif 404 di sini juga.

const STATUS_VARIANT: Record<LibraryStatus, "secondary" | "success" | "destructive" | "outline"> = {
  draft: "secondary",
  in_review: "outline",
  published: "success",
  deprecated: "destructive",
  archived: "outline",
};

export default async function AdminComponentDetailPage({ params }: { params: Promise<{ componentId: string }> }) {
  const { componentId } = await params;
  const t = await getTranslations("admin.library");
  const td = await getTranslations("admin.libraryDetail");
  const format = await getFormatter();

  const data = await withSession((api) =>
    Promise.all([
      api.library.editorSession(componentId),
      api.library.versions(componentId),
      api.library.usage(componentId),
    ]),
  ).catch((error) => {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  });
  const [session, versions, usage] = data;
  const { component, capabilities } = session;
  const totalSites = usage.reduce((sum, row) => sum + row.siteCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/library" className="text-xs text-muted-foreground hover:underline">
          ← {td("back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{component.displayName.en || component.name}</h1>
          <span data-testid="admin-component-status">
            <Badge variant={STATUS_VARIANT[component.status]}>{t(`status.${component.status}`)}</Badge>
          </span>
          <span className="text-sm text-muted-foreground">{component.kind}</span>
          {component.latestVersion ? (
            <span className="text-sm text-muted-foreground">v{component.latestVersion}</span>
          ) : null}
        </div>
      </div>

      {capabilities.canPublish ? (
        <section className="flex flex-col gap-2 rounded border p-4">
          <h2 className="text-sm font-semibold">{td("actions")}</h2>
          <AdminComponentActions componentId={component.id} status={component.status} />
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{td("usage")}</h2>
        <p className="text-sm text-muted-foreground" data-testid="admin-component-usage">
          {totalSites > 0 ? td("usageSites", { count: totalSites }) : td("noUsage")}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{td("versions")}</h2>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm" data-testid="admin-component-versions">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("columns.version")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.status")}</th>
                <th className="px-3 py-2 font-medium">{td("changelog")}</th>
                <th className="px-3 py-2 font-medium">{td("created")}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={`${version.versionSeq ?? "draft"}`} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{version.version ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[version.status]}>{t(`status.${version.status}`)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{version.changelog?.en ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format.dateTime(new Date(version.createdAt), { dateStyle: "medium" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
