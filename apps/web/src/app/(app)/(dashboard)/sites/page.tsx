import { Badge, Button, Card } from "@platform/ui";
import { GlobeIcon } from "lucide-react";
import { getFormatter, getNow, getTranslations } from "next-intl/server";
import { CreateSiteDialog } from "../../../../components/dashboard/CreateSiteDialog";
import { withSession } from "../../../../lib/api/server";
import { getDashboardSession } from "../../../../lib/workspace/current";

const STATUS_VARIANT = {
  draft: "secondary",
  published: "success",
  suspended: "destructive",
  archived: "outline",
} as const;

// Daftar situs (ACC-050): kartu nama + status + terakhir diedit → editor; kosong → empty state; 24 per halaman
// (cursor api). Thumbnail, URL live, filter/urutan/cari & aksi cepat menyusul bersama fiturnya (publish M4).
// Tombol "Buat website" (ACC-051) di header — terlihat juga saat empty state.
export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { cursor } = await searchParams;
  const { current } = await getDashboardSession();
  const page = await withSession((api) => api.sites.list(current.id, cursor ? { cursor } : {}));
  const sites = page.items;
  const nextCursor = page.nextCursor;
  const t = await getTranslations("dashboard.sites");
  const format = await getFormatter();
  const now = await getNow();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <CreateSiteDialog workspaceId={current.id} />
      </div>

      {sites.length === 0 && !cursor ? (
        <Card className="items-center gap-2 py-16 text-center" data-testid="sites-empty">
          <GlobeIcon className="size-10 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{t("empty.description")}</p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <li key={site.id}>
              <a
                href={`/editor/${site.id}`}
                aria-label={t("open", { name: site.name })}
                className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="gap-3 px-5 py-5 transition-colors hover:bg-accent/50" data-testid="site-card">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="truncate font-semibold">{site.name}</h2>
                    <Badge variant={STATUS_VARIANT[site.status]}>{t(`status.${site.status}`)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <time dateTime={site.updatedAt}>
                      {t("edited", { time: format.relativeTime(new Date(site.updatedAt), now) })}
                    </time>
                  </p>
                </Card>
              </a>
            </li>
          ))}
        </ul>
      )}

      {nextCursor || cursor ? (
        <nav aria-label={t("pagination.label")} className="flex gap-3">
          {cursor ? (
            <Button asChild variant="outline">
              <a href="/sites">{t("pagination.first")}</a>
            </Button>
          ) : null}
          {nextCursor ? (
            <Button asChild variant="outline">
              <a href={`/sites?cursor=${encodeURIComponent(nextCursor)}`}>{t("pagination.next")}</a>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
