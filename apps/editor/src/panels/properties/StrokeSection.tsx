import { type Node, resolveStyle, runCommand, type Stroke, updateStyle } from "@platform/document-model";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { ColorInput } from "./color/ColorInput";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput } from "./inputs/NumberInput";

// ED-106/DM-030: stroke (warna, tebal, posisi, gaya). Maks 1 stroke (StrokesSchema). Per-sisi = P2.
const STROKABLE = new Set<Node["type"]>(["frame", "shape", "image"]);
const POSITIONS = ["inside", "center", "outside"] as const;
const STYLES = ["solid", "dashed", "dotted"] as const;

const widthPx = (w: Stroke["width"]) => (w && "value" in w ? w.value : 1);

export function StrokeSection({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const node = nodes[0];
  if (!node || !nodes.every((n) => STROKABLE.has(n.type))) return null;
  const stroke = resolveStyle(node.style, "base").strokes?.[0];

  const setStrokes = (next: Stroke[]) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      for (const target of nodes) {
        runCommand(runtime.commandCtx, updateStyle, {
          ids: [target.id],
          patch: { strokes: next },
        });
      }
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };
  const patchStroke = (patch: Partial<Stroke>) => stroke && setStrokes([{ ...stroke, ...patch }]);

  return (
    <InspectorSection id="stroke" title={t("inspector.stroke")}>
      {stroke ? (
        <div className="flex flex-col gap-2">
          <InspectorRow label={t("inspector.color")}>
            <div className="flex items-center gap-2">
              <ColorInput
                value={typeof stroke.color === "string" ? stroke.color : "#000000"}
                readOnly={readOnly}
                testId="stroke-color"
                onChange={(hex) => patchStroke({ color: hex })}
              />
              <button
                type="button"
                disabled={readOnly}
                aria-label={t("inspector.removeStroke")}
                data-testid="stroke-remove"
                className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-40"
                onClick={() => setStrokes([])}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </InspectorRow>
          <InspectorRow label={t("inspector.strokeWidth")}>
            <div className="grid grid-cols-2 gap-1">
              <NumberInput
                label={t("inspector.strokeWidth")}
                scrubLabel="W"
                value={widthPx(stroke.width)}
                min={0}
                testId="stroke-width"
                onCommit={(update) =>
                  patchStroke({ width: { value: Math.max(0, update(widthPx(stroke.width))), unit: "px" } })
                }
              />
            </div>
          </InspectorRow>
          <InspectorRow label={t("inspector.strokePosition")}>
            <select
              aria-label={t("inspector.strokePosition")}
              data-testid="stroke-position"
              disabled={readOnly}
              value={stroke.position ?? "inside"}
              onChange={(event) => patchStroke({ position: event.target.value as (typeof POSITIONS)[number] })}
              className="h-7 w-full rounded border border-transparent bg-muted/50 px-1 text-xs hover:border-border"
            >
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {t(`inspector.strokePosition_${position}`)}
                </option>
              ))}
            </select>
          </InspectorRow>
          <InspectorRow label={t("inspector.strokeStyle")}>
            <select
              aria-label={t("inspector.strokeStyle")}
              data-testid="stroke-style"
              disabled={readOnly}
              value={stroke.style ?? "solid"}
              onChange={(event) => patchStroke({ style: event.target.value as (typeof STYLES)[number] })}
              className="h-7 w-full rounded border border-transparent bg-muted/50 px-1 text-xs hover:border-border"
            >
              {STYLES.map((style) => (
                <option key={style} value={style}>
                  {t(`inspector.strokeStyle_${style}`)}
                </option>
              ))}
            </select>
          </InspectorRow>
        </div>
      ) : (
        <button
          type="button"
          disabled={readOnly}
          data-testid="stroke-add"
          className="flex items-center gap-1 self-start rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
          onClick={() => setStrokes([{ color: "#000000", width: { value: 1, unit: "px" } }])}
        >
          <Plus className="size-3.5" />
          {t("inspector.addStroke")}
        </button>
      )}
    </InspectorSection>
  );
}
