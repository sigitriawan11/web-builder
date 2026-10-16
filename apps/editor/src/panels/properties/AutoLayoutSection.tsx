import { type LayoutStyle, type Node, resolveStyle, runCommand, updateStyle } from "@platform/document-model";
import { cn } from "@platform/ui";
import { ArrowDown, ArrowRight, WrapText } from "lucide-react";
import type { ComponentType } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { InspectorRow, InspectorSection } from "./InspectorSection";

// ED-080: arah auto-layout (Vertical / Horizontal / Wrap). Hanya tampil untuk frame auto-layout terseleksi.

type Direction = "column" | "row" | "wrap";
const DIRECTIONS: { id: Direction; icon: ComponentType<{ className?: string }> }[] = [
  { id: "column", icon: ArrowDown },
  { id: "row", icon: ArrowRight },
  { id: "wrap", icon: WrapText },
];

type FlexLayout = Extract<LayoutStyle, { mode: "flex" }>;

function flexLayout(node: Node): FlexLayout | undefined {
  const layout = resolveStyle(node.style, "base").layout;
  return layout?.mode === "flex" ? layout : undefined;
}

export function AutoLayoutSection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const layouts = nodes.map(flexLayout);
  // Hanya saat SEMUA node terseleksi adalah frame auto-layout.
  if (nodes.length === 0 || layouts.some((layout) => layout === undefined)) return null;

  const first = layouts[0] as FlexLayout;
  const current: Direction = first.wrap ? "wrap" : (first.direction ?? "row");

  const setDirection = (direction: Direction) => {
    if (readOnly) return;
    const patch = direction === "wrap" ? { direction: "row" as const, wrap: true } : { direction, wrap: false };
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const node of nodes) {
        runCommand({ doc: runtime.doc, origin: runtime.origin }, updateStyle, {
          ids: [node.id],
          patch: { layout: patch },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  return (
    <InspectorSection id="auto-layout" title={t("inspector.autoLayout")}>
      <InspectorRow label={t("inspector.direction")}>
        <div className="flex items-center gap-0.5" role="toolbar" aria-label={t("inspector.direction")}>
          {DIRECTIONS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={readOnly}
              aria-pressed={current === id}
              aria-label={t(`inspector.direction_${id}`)}
              title={t(`inspector.direction_${id}`)}
              data-testid={`auto-layout-direction-${id}`}
              className={cn(
                "flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
                current === id && "bg-accent text-foreground",
              )}
              onClick={() => setDirection(id)}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </InspectorRow>
    </InspectorSection>
  );
}
