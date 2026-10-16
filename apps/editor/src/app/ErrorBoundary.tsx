import { Button } from "@platform/ui";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "../telemetry/telemetry";
import { useT } from "./i18n";

// Error boundary aplikasi (ARCHITECTURE §5.2, ED-228): kesalahan render tak terduga → layar pemulihan, bukan halaman
// putih. Di editor situs, layar ini juga menawarkan "Buka versi terakhir yang tersimpan" (buang cache lokal, muat dari
// server) dan ID error untuk bantuan (tag `error_id` di Sentry, T1.15.16).
export interface RecoveryOptions {
  // Buang data lokal dokumen (IndexedDB) lalu muat ulang dari server.
  openLastSaved?: () => Promise<void>;
}

function ErrorScreen({ errorId, recovery }: { errorId: string; recovery: RecoveryOptions | undefined }) {
  const t = useT();
  const openLastSaved = recovery?.openLastSaved;
  return (
    <main role="alert" className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <h1 className="text-xl font-semibold">{t("app.error.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("app.error.description")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>{t("app.error.reload")}</Button>
        {openLastSaved ? (
          <Button
            variant="outline"
            onClick={async () => {
              await openLastSaved();
              window.location.reload();
            }}
          >
            {t("app.error.openSaved")}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground" data-testid="error-id">
        {t("app.error.support", { id: errorId })}
      </p>
    </main>
  );
}

interface Props {
  children: ReactNode;
  recovery?: RecoveryOptions;
}

export class AppErrorBoundary extends Component<Props, { errorId: string | null }> {
  override state: { errorId: string | null } = { errorId: null };

  static getDerivedStateFromError(): { errorId: string } {
    // ID pendek untuk disebutkan ke bantuan; dicocokkan dengan log/Sentry (T1.15.16).
    return { errorId: crypto.randomUUID().slice(0, 8) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { area: "app", ...(this.state.errorId ? { errorId: this.state.errorId } : {}) });
    console.error(info.componentStack);
  }

  override render(): ReactNode {
    return this.state.errorId ? (
      <ErrorScreen errorId={this.state.errorId} recovery={this.props.recovery} />
    ) : (
      this.props.children
    );
  }
}
