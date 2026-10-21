import {
  type LayoutStyle,
  type Node,
  resolveStyle,
  runCommand,
  type StylePatch,
  updateStyle,
} from "@platform/document-model";
import { cn } from "@platform/ui";
import { AlignHorizontalSpaceBetween, ArrowDown, ArrowRight, SquareDashed, WrapText } from "lucide-react";
import { type ComponentType, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput, type NumberUpdate } from "./inputs/NumberInput";
import { mixedValue } from "./mixed";

// ED-080/081/082: panel auto-layout — arah (Vertical/Horizontal/Wrap), gap (+ Auto = space-between), padding
// (H/V atau per sisi). Hanya tampil untuk frame auto-layout terseleksi; perubahan ke semua node sekaligus.

type Direction = "column" | "row" | "wrap";
type Side = "top" | "right" | "bottom" | "left";
type FlexLayout = Extract<LayoutStyle, { mode: "flex" }>;

const DIRECTIONS: { id: Direction; icon: ComponentType<{ className?: string }> }[] = [
  { id: "column", icon: ArrowDown },
  { id: "row", icon: ArrowRight },
  { id: "wrap", icon: WrapText },
];

function flexLayout(node: Node): FlexLayout | undefined {
  const layout = resolveStyle(node.style, "base").layout;
  return layout?.mode === "flex" ? layout : undefined;
}

// Nilai numerik px dari Length (bisa `{value,unit}` atau token `{$token}` → undefined untuk input numerik).
function lengthValue(length: FlexLayout["gap"]): number | undefined {
  return length && "value" in length ? length.value : undefined;
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
  const [perSide, setPerSide] = useState(false);
  const layouts = nodes.map(flexLayout);
  if (nodes.length === 0 || layouts.some((layout) => layout === undefined)) return null;
  const flexLayouts = layouts as FlexLayout[];

  const first = flexLayouts[0] as FlexLayout;
  const direction: Direction = first.wrap ? "wrap" : (first.direction ?? "row");
  const autoGap = first.justify === "spaceBetween";

  // Terapkan patch layout ke semua node dalam satu transaksi (satu langkah undo).
  const applyLayout = (patch: NonNullable<StylePatch["layout"]>) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const node of nodes) {
        runCommand(runtime.commandCtx, updateStyle, {
          ids: [node.id],
          patch: { layout: patch },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  const setDirection = (next: Direction) =>
    applyLayout(next === "wrap" ? { direction: "row", wrap: true } : { direction: next, wrap: false });

  // Gap/padding: hitung nilai baru per node (NumberInput mengirim fungsi relatif-aware).
  const applyPerNode = (compute: (layout: FlexLayout) => NonNullable<StylePatch["layout"]> | null) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const node of nodes) {
        const layout = flexLayout(node);
        const patch = layout ? compute(layout) : null;
        if (patch)
          runCommand(runtime.commandCtx, updateStyle, {
            ids: [node.id],
            patch: { layout: patch },
          });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  const setGap = (update: NumberUpdate) =>
    applyPerNode((layout) => ({ gap: { value: Math.max(0, update(lengthValue(layout.gap) ?? 0)), unit: "px" } }));

  const setPadding = (sides: readonly Side[], update: NumberUpdate) =>
    applyPerNode((layout) => {
      const padding: Record<string, { value: number; unit: "px" }> = {};
      for (const side of sides)
        padding[side] = { value: Math.max(0, update(lengthValue(layout.padding?.[side]) ?? 0)), unit: "px" };
      return { padding };
    });

  const gapValue = mixedValue(flexLayouts.map((layout) => lengthValue(layout.gap)));
  const padValue = (sides: readonly Side[]) =>
    mixedValue(
      flexLayouts.map((layout) => (sides.length === 1 ? lengthValue(layout.padding?.[sides[0] as Side]) : undefined)),
    );

  // ED-083: alignment 9-titik. Grid kolom = sumbu horizontal, baris = vertikal; main/cross axis tergantung arah.
  const ALIGN_NAMES = ["start", "center", "end"] as const;
  const idxOf = (value: string | undefined) => Math.max(0, ALIGN_NAMES.indexOf((value ?? "start") as "start"));
  const justifyIdx = idxOf(first.justify);
  const alignIdx = idxOf(first.align);
  const activeCol = direction === "row" ? justifyIdx : alignIdx;
  const activeRow = direction === "row" ? alignIdx : justifyIdx;
  const setAlign = (col: number, row: number) => {
    const mainIdx = direction === "row" ? col : row;
    const crossIdx = direction === "row" ? row : col;
    applyLayout({ justify: ALIGN_NAMES[mainIdx], align: ALIGN_NAMES[crossIdx] });
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
              aria-pressed={direction === id}
              aria-label={t(`inspector.direction_${id}`)}
              title={t(`inspector.direction_${id}`)}
              data-testid={`auto-layout-direction-${id}`}
              className={cn(
                "flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
                direction === id && "bg-accent text-foreground",
              )}
              onClick={() => setDirection(id)}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </InspectorRow>

      <InspectorRow label={t("inspector.gap")}>
        <div className="flex items-center gap-1">
          <NumberInput
            label={t("inspector.gap")}
            scrubLabel={<ArrowRight className="size-3" />}
            value={autoGap ? undefined : gapValue}
            min={0}
            testId="auto-layout-gap"
            onCommit={setGap}
          />
          <button
            type="button"
            disabled={readOnly}
            aria-pressed={autoGap}
            aria-label={t("inspector.gapAuto")}
            title={t("inspector.gapAuto")}
            data-testid="auto-layout-gap-auto"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
              autoGap && "bg-accent text-foreground",
            )}
            onClick={() => applyLayout({ justify: autoGap ? "start" : "spaceBetween" })}
          >
            <AlignHorizontalSpaceBetween className="size-3.5" />
          </button>
        </div>
      </InspectorRow>

      <InspectorRow label={t("inspector.padding")}>
        <div className="flex items-center gap-1">
          {perSide ? (
            <div className="grid grid-cols-2 gap-1">
              <NumberInput
                label={t("inspector.paddingTop")}
                scrubLabel="T"
                value={padValue(["top"])}
                min={0}
                testId="auto-layout-padding-top"
                onCommit={(u) => setPadding(["top"], u)}
              />
              <NumberInput
                label={t("inspector.paddingRight")}
                scrubLabel="R"
                value={padValue(["right"])}
                min={0}
                testId="auto-layout-padding-right"
                onCommit={(u) => setPadding(["right"], u)}
              />
              <NumberInput
                label={t("inspector.paddingBottom")}
                scrubLabel="B"
                value={padValue(["bottom"])}
                min={0}
                testId="auto-layout-padding-bottom"
                onCommit={(u) => setPadding(["bottom"], u)}
              />
              <NumberInput
                label={t("inspector.paddingLeft")}
                scrubLabel="L"
                value={padValue(["left"])}
                min={0}
                testId="auto-layout-padding-left"
                onCommit={(u) => setPadding(["left"], u)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              <NumberInput
                label={t("inspector.paddingHorizontal")}
                scrubLabel="H"
                value={padValue(["left"])}
                min={0}
                testId="auto-layout-padding-h"
                onCommit={(u) => setPadding(["left", "right"], u)}
              />
              <NumberInput
                label={t("inspector.paddingVertical")}
                scrubLabel="V"
                value={padValue(["top"])}
                min={0}
                testId="auto-layout-padding-v"
                onCommit={(u) => setPadding(["top", "bottom"], u)}
              />
            </div>
          )}
          <button
            type="button"
            aria-pressed={perSide}
            aria-label={t("inspector.paddingPerSide")}
            title={t("inspector.paddingPerSide")}
            data-testid="auto-layout-padding-per-side"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
              perSide && "bg-accent text-foreground",
            )}
            onClick={() => setPerSide((value) => !value)}
          >
            <SquareDashed className="size-3.5" />
          </button>
        </div>
      </InspectorRow>

      <InspectorRow label={t("inspector.alignment")}>
        <div className="grid w-fit grid-cols-3 gap-px rounded border p-0.5">
          {[0, 1, 2].map((row) =>
            [0, 1, 2].map((col) => {
              const active = !autoGap && activeCol === col && activeRow === row;
              return (
                <button
                  key={`${col}-${row}`}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={active}
                  aria-label={`${t("inspector.alignment")} ${col + 1},${row + 1}`}
                  data-testid={`auto-layout-align-${col}-${row}`}
                  className="flex size-4 items-center justify-center rounded-sm hover:bg-accent disabled:opacity-40"
                  onClick={() => setAlign(col, row)}
                >
                  <span className={cn("size-1 rounded-full", active ? "bg-foreground" : "bg-muted-foreground/40")} />
                </button>
              );
            }),
          )}
        </div>
      </InspectorRow>
    </InspectorSection>
  );
}
