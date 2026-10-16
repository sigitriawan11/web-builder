import { isApiError } from "@platform/sdk";
import { useSite } from "@platform/sdk/react";
import type { Site } from "@platform/shared/contracts";
import { Button } from "@platform/ui";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect } from "react";
import { useT } from "./i18n";
import { LanguageMenu, ProfileLocaleSync } from "./LanguageMenu";
// Tailwind + token UI hanya dimuat rute produk (modul ini di-lazy-load): playground canvas M0 & mode isolasi
// eksperimennya (prefix/none, ADR-012) tetap tanpa preflight global.
import "../styles/app.css";

// Editor satu situs (`/editor/:siteId`): situs dimuat lewat api (izin & isolasi tenant ditegakkan server). Tidak ada
// / bukan milik user → layar "tidak ditemukan" (api 404 untuk keduanya, tidak membocorkan keberadaan). Sesi basi →
// login. Dokumen Y.Doc & canvas renderer dipasang T1.15.7–T1.15.8.
export function SiteEditor({ siteId, pageId }: { siteId: string; pageId: string | null }) {
  const t = useT();
  const site = useSite(siteId);
  const status = isApiError(site.error) ? site.error.status : null;

  useEffect(() => {
    if (status === 401) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status]);

  if (site.isPending || status === 401) {
    return (
      <main className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground" aria-busy>
        {t("app.loading")}
      </main>
    );
  }
  if (status === 404 || status === 403) return <SiteNotFound />;
  if (site.error) throw site.error;
  return <EditorShell site={site.data} pageId={pageId} />;
}

function EditorShell({ site, pageId }: { site: Site; pageId: string | null }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Button asChild variant="ghost" size="icon" aria-label={t("app.back")} title={t("app.back")}>
          <a href="/sites">
            <ArrowLeftIcon />
          </a>
        </Button>
        <h1 className="truncate text-sm font-semibold" data-testid="editor-site-name">
          {site.name}
        </h1>
        <div className="ml-auto flex items-center gap-1">
          <LanguageMenu />
        </div>
      </header>
      <ProfileLocaleSync />
      <main
        className="flex flex-1 items-center justify-center bg-muted/40 text-sm text-muted-foreground"
        data-testid="editor-canvas-slot"
        data-page-id={pageId ?? ""}
      >
        {t("app.canvasPending")}
      </main>
    </div>
  );
}

export function SiteNotFound() {
  const t = useT();
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <p className="text-5xl font-bold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">{t("app.notFound.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("app.notFound.description")}</p>
      <Button asChild variant="outline">
        <a href="/sites">{t("app.notFound.back")}</a>
      </Button>
    </main>
  );
}
