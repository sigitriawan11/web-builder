import { Button } from "@platform/ui";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "./i18n";

function PanelError({ onReload }: { onReload: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="flex flex-col items-start gap-2 p-3 text-sm">
      <p className="text-muted-foreground">{t("panelError.title")}</p>
      <Button type="button" variant="outline" size="sm" onClick={onReload}>
        {t("panelError.reload")}
      </Button>
    </div>
  );
}

// ED-228: panel (pages, layers, inspector, AI) punya boundary sendiri — "Muat ulang panel" me-mount ulang isinya.
export class PanelErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean; generation: number }
> {
  override state = { failed: false, generation: 0 };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`editor: panel "${this.props.name}" gagal dirender`, error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <PanelError onReload={() => this.setState((state) => ({ failed: false, generation: state.generation + 1 }))} />
      );
    }
    return <PanelContent key={this.state.generation}>{this.props.children}</PanelContent>;
  }
}

function PanelContent({ children }: { children: ReactNode }) {
  return children;
}
