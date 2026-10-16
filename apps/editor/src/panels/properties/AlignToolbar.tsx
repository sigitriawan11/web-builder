import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import type { ComponentType } from "react";
import { useT } from "../../app/i18n";
import type { AlignEdge, DistributeAxis } from "../../canvas/align";
import { applyAlign, applyDistribute } from "../../canvas/align-commands";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";

// ED-072: baris tombol align (6 arah) & distribute (H/V) di atas properti. Hanya node absolute yang digeser;
// distribute aktif untuk ≥ 3 node.
type Icon = ComponentType<{ className?: string }>;
const ALIGN_BUTTONS: { edge: AlignEdge; icon: Icon }[] = [
  { edge: "left", icon: AlignStartVertical },
  { edge: "hcenter", icon: AlignCenterVertical },
  { edge: "right", icon: AlignEndVertical },
  { edge: "top", icon: AlignStartHorizontal },
  { edge: "vcenter", icon: AlignCenterHorizontal },
  { edge: "bottom", icon: AlignEndHorizontal },
];
const DISTRIBUTE_BUTTONS: { axis: DistributeAxis; icon: Icon }[] = [
  { axis: "horizontal", icon: AlignHorizontalDistributeCenter },
  { axis: "vertical", icon: AlignVerticalDistributeCenter },
];

export function AlignToolbar({
  runtime,
  selectedIds,
  readOnly,
}: {
  runtime: CanvasRuntime;
  selectedIds: readonly string[];
  readOnly: boolean;
}) {
  const t = useT();
  const canDistribute = selectedIds.length >= 3;

  return (
    <div className="flex items-center gap-0.5" role="toolbar" aria-label={t("inspector.align.label")}>
      {ALIGN_BUTTONS.map(({ edge, icon: Icon }) => (
        <button
          key={edge}
          type="button"
          disabled={readOnly}
          aria-label={t(`inspector.align.${edge}`)}
          title={t(`inspector.align.${edge}`)}
          data-testid={`align-${edge}`}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          onClick={() => applyAlign(runtime, selectedIds, edge)}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px bg-border" />
      {DISTRIBUTE_BUTTONS.map(({ axis, icon: Icon }) => (
        <button
          key={axis}
          type="button"
          disabled={readOnly || !canDistribute}
          aria-label={t(`inspector.distribute.${axis}`)}
          title={t(`inspector.distribute.${axis}`)}
          data-testid={`distribute-${axis}`}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          onClick={() => applyDistribute(runtime, selectedIds, axis)}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
