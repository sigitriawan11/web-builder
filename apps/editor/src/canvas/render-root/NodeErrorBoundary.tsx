import {
  Component,
  createContext,
  type ErrorInfo,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useT } from "../../app/i18n";
import type { NodeStore } from "../../document/node-store";
import { NodeStoreContext } from "../../document/use-node";
import { reportError } from "../../telemetry/telemetry";

// ED-228: aksi placeholder node rusak. Disediakan canvas (butuh command & origin); tanpa provider (test, render
// statis) tombol tidak ditampilkan.
export interface NodeErrorActions {
  deleteNode(id: string): void;
  reportNode(id: string, error: unknown): void;
}
export const NodeErrorActionsContext = createContext<NodeErrorActions | null>(null);

// Garis-garis merah: jelas "rusak" tanpa bergantung CSS situs (dirender di dalam canvas/shadow root).
const PLACEHOLDER_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 48,
  padding: "8px 12px",
  boxSizing: "border-box",
  border: "1px solid #dc2626",
  color: "#991b1b",
  font: "12px system-ui, sans-serif",
  background: "repeating-linear-gradient(45deg, #fee2e2 0 8px, #fecaca 8px 16px)",
} as const;
const BUTTON_STYLE = {
  font: "inherit",
  padding: "2px 8px",
  border: "1px solid #dc2626",
  borderRadius: 4,
  background: "#fff",
  color: "#991b1b",
  cursor: "pointer",
} as const;

/** Kotak pengganti node yang datanya invalid atau gagal dirender. Tetap ber-`data-node-id` agar bisa dipilih. */
export function NodePlaceholder({ id, error }: { id: string; error?: unknown }) {
  const t = useT();
  const actions = useContext(NodeErrorActionsContext);
  const [reported, setReported] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Listener viewport (pan/seleksi) memakai event native yang bubble sebelum event React → hentikan di sini.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const stop = (event: Event) => {
      if ((event.target as Element | null)?.closest("button")) event.stopPropagation();
    };
    element.addEventListener("pointerdown", stop);
    return () => element.removeEventListener("pointerdown", stop);
  }, []);

  return (
    <div ref={rootRef} data-node-id={id} data-node-error="" role="alert" style={PLACEHOLDER_STYLE}>
      <span>{t("nodeError.label")}</span>
      {actions ? (
        <>
          <button type="button" style={BUTTON_STYLE} onClick={() => actions.deleteNode(id)}>
            {t("nodeError.delete")}
          </button>
          {reported ? (
            <span>{t("nodeError.reported")}</span>
          ) : (
            <button
              type="button"
              style={BUTTON_STYLE}
              onClick={() => {
                actions.reportNode(id, error ?? new Error(`Node "${id}" tidak valid`));
                setReported(true);
              }}
            >
              {t("nodeError.report")}
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}

interface BoundaryProps {
  id: string;
  children: ReactNode;
}

/**
 * ED-228: error render satu node tidak menjatuhkan canvas — node itu (dan subtree-nya) diganti placeholder.
 * Dicoba lagi otomatis saat node berubah (mis. diperbaiki undo atau kolaborator).
 */
export class NodeErrorBoundary extends Component<BoundaryProps, { error: unknown }> {
  static override contextType = NodeStoreContext;
  declare context: NodeStore | null;
  override state: { error: unknown } = { error: null };
  private unsubscribe: (() => void) | null = null;

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  override componentDidMount(): void {
    this.unsubscribe =
      this.context?.subscribe(this.props.id, () => {
        if (this.state.error) this.setState({ error: null });
      }) ?? null;
  }

  override componentWillUnmount(): void {
    this.unsubscribe?.();
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, { area: "node" });
    console.error(`editor: node "${this.props.id}" gagal dirender`, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.error ? <NodePlaceholder id={this.props.id} error={this.state.error} /> : this.props.children;
  }
}
