import { isApiError } from "@platform/sdk";
import type { LibraryStatus } from "@platform/shared/contracts";
import { Badge } from "@platform/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { withSession } from "../../../../../lib/api/server";

// ACC-208/T3.8.1: daftar component admin (semua status) dengan filter status. Role-gate di layout (`getStaffCapabilities`).
// Detail versi/usage + aksi deprecate/archive = T3.8.2; tampil thumbnail = bersama T3.7.3 (admin).

const STATUSES: readonly LibraryStatus[] = ["draft", "in_review", "published", "deprecated", "archived"];
const STATUS_VARIANT: Record<LibraryStatus, "secondary" | "success" | "destructive" | "outline"> = {
  draft: "secondary",
  in_review: "outline",
  published: "success",
  deprecated: "destructive",
  archived: "outline",
};

export default async function AdminLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const status = STATUSES.includes(params.status as LibraryStatus) ? (params.status as LibraryStatus) : undefined;
  const search = params.search?.trim() || undefined;
  // Role-gate utama di layout (`getStaffCapabilities`); di sini defensif: 404 (non-staf) → notFound, bukan 500.
  const { items, total } = await withSession((api) =>
    api.library.listAdminComponents({ ...(status ? { status } : {}), ...(search ? { search } : {}) }),
  ).catch((error) => {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  });
  const t = await getTranslations("admin.library");
  const format = await getFormatter();

  const href = (next: LibraryStatus | undefined) => (next ? `?status=${next}` : "?");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="admin-library-filters">
        <Link
          href={href(undefined)}
          className={`rounded-full border px-3 py-1 text-xs ${status ? "" : "bg-accent font-medium"}`}
        >
          {t("filterAll")}
        </Link>
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={href(value)}
            data-testid={`admin-library-filter-${value}`}
            className={`rounded-full border px-3 py-1 text-xs ${status === value ? "bg-accent font-medium" : ""}`}
          >
            {t(`status.${value}`)}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="admin-library-empty">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm" data-testid="admin-library-table">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("columns.name")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.kind")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.category")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.status")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.version")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("columns.usage")}</th>
                <th className="px-3 py-2 font-medium">{t("columns.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0" data-testid={`admin-library-row-${item.publicId}`}>
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.kind}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.categorySlug}</td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[item.status]}>{t(`status.${item.status}`)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{item.latestVersion ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.usageSiteCount}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {format.dateTime(new Date(item.updatedAt), { dateStyle: "medium" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-muted-foreground">{total}</p>
        </div>
      )}
    </div>
  );
}
