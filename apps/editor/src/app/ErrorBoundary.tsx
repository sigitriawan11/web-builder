import { Button } from "@platform/ui";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "./i18n";

// Error boundary aplikasi (ARCHITECTURE §5.2): kesalahan render tak terduga → layar pemulihan, bukan halaman putih.
// Boundary per node & per panel = T1.15.13; pelaporan Sentry = T1.15.16.
function ErrorScreen() {
  const t = useT();
  return (
    <main role="alert" className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <h1 className="text-xl font-semibold">{t("app.error.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("app.error.description")}</p>
      <Button onClick={() => window.location.reload()}>{t("app.error.reload")}</Button>
    </main>
  );
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("editor: kesalahan render", error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? <ErrorScreen /> : this.props.children;
  }
}
