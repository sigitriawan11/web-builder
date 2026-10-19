import { isApiError } from "@platform/sdk";
import { useLibraryEditorSession } from "@platform/sdk/react";
import { useEffect } from "react";
import { useLocale, useT } from "./i18n";
import { SiteNotFound } from "./SiteEditor";

// T3.4.1 (CMP-010/ED-003): shell editor Mode Admin. Akses diverifikasi SERVER (GET /v1/admin/library/components/:id):
// bukan staf → 404 (sama seperti situs tak ada → "user biasa tidak melihat Mode Admin"); staf read-only → badge +
// catatan baca-saja. Canvas ComponentDefinition menyusul (T3.4.2, codec + create). Badge ADMIN selalu tampil.
export function LibraryEditor({ componentId }: { componentId: string }) {
  const t = useT();
  const locale = useLocale();
  const session = useLibraryEditorSession(componentId);
  const status = isApiError(session.error) ? session.error.status : null;

  useEffect(() => {
    if (status === 401) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status]);

  if (session.isPending || status === 401) {
    return (
      <main className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground" aria-busy>
        {t("app.loading")}
      </main>
    );
  }
  // 404 (bukan staf) & 403 (staf tanpa akses baca — tidak terjadi untuk GET, tapi aman) → tidak ditemukan.
  if (status === 404 || status === 403) return <SiteNotFound />;
  if (session.error) throw session.error;

  const { component, capabilities } = session.data;
  const displayName = component.displayName[locale] || component.displayName.id;
  return (
    <div className="flex h-full flex-col bg-background text-foreground" data-admin-mode="library">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <span
          className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold tracking-wide text-black"
          data-testid="admin-badge"
        >
          {t("admin.badge")}
        </span>
        <span className="text-sm font-medium">{displayName}</span>
        <span className="text-xs text-muted-foreground">{component.publicId}</span>
        {!capabilities.canEditDraft ? (
          <span className="ml-auto text-xs text-muted-foreground" data-testid="admin-readonly">
            {t("admin.readOnly")}
          </span>
        ) : null}
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center bg-muted/40 text-sm text-muted-foreground">
        {t("admin.canvasPending")}
      </main>
    </div>
  );
}
